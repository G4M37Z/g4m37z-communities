// ============================================================================
// src/lib/posts/actions.ts
// Server Actions for the Posts feature (Milestone 4).
//
// All mutations run through the cookie-bound Supabase client so RLS continues
// to enforce ownership (auth.uid() = author_id, etc.).
// ============================================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TITLE_MIN = 3;
const TITLE_MAX = 200;
const BODY_MAX = 20000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Build a unique upload path for a post image. Uses crypto.randomUUID when
 * available; falls back to a timestamped random string so server-action
 * bundlers that strip the `crypto` global still produce a unique path.
 */
function uniqueId(): string {
  try {
    const c =
      (typeof globalThis !== "undefined" && (globalThis as { crypto?: Crypto }).crypto) ||
      (typeof crypto !== "undefined" ? crypto : undefined);
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // fall through to fallback
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateTitle(title: string): string | null {
  const t = title.trim();
  if (t.length < TITLE_MIN) return `Title must be at least ${TITLE_MIN} characters.`;
  if (t.length > TITLE_MAX) return `Title must be ${TITLE_MAX} characters or fewer.`;
  return null;
}

function validateBody(body: string): string | null {
  const b = body.trim();
  if (b.length === 0) return null; // body is optional
  if (b.length > BODY_MAX) return `Body must be ${BODY_MAX} characters or fewer.`;
  return null;
}

/**
 * Sniff the first bytes of an uploaded file and return the image type it
 * actually is, or null when the bytes match no supported image signature.
 * Browser MIME (`file.type`) is client-controlled, so we refuse anything
 * whose content is not genuinely a JPEG/PNG/WebP/GIF.
 */
async function sniffImageType(file: File): Promise<(typeof IMAGE_MIME)[number] | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
  const b = (i: number) => bytes[i];
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 &&
    b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38 &&
    (b(4) === 0x37 || b(4) === 0x39) && b(5) === 0x61
  ) {
    return "image/gif";
  }
  return null;
}

function validateImage(file: File): string | null {
  if (file.size === 0) return "Image file is empty.";
  if (file.size > IMAGE_MAX_BYTES) return "Image must be 5 MB or smaller.";
  if (!IMAGE_MIME.includes(file.type)) {
    return "Image must be JPEG, PNG, WebP, or GIF.";
  }
  return null;
}

/**
 * Extract the object path inside the post-images bucket from a public URL,
 * or null when the URL is not a post-images object URL.
 */
function postImagePathFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const configuredHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  if (configuredHost && parsed.host !== configuredHost) return null;
  const m = parsed.pathname.match(/^\/storage\/v1\/object\/public\/post-images\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Validate that an imageUrl is a real post-images object owned by `ownerId`. */
function validateOwnedImageUrl(imageUrl: string, ownerId: string): string | null {
  const path = postImagePathFromUrl(imageUrl);
  if (!path) return "That image doesn't look like a valid upload.";
  const owner = path.split("/")[0];
  if (!owner || owner !== ownerId) {
    return "That image isn't one of your uploads.";
  }
  return null;
}

/** Best-effort remove of an author's own post-images object (RLS-scoped). */
async function removeAuthorPostImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageUrl: string | null,
  ownerId: string
): Promise<void> {
  if (!imageUrl) return;
  const path = postImagePathFromUrl(imageUrl);
  if (!path) return;
  if (path.split("/")[0] !== ownerId) return;
  try {
    await supabase.storage.from("post-images").remove([path]);
  } catch (err) {
    console.error("removeAuthorPostImage failed:", err);
  }
}

// Exported for deterministic unit coverage (tests/launch-hardening.test.ts).
export const __postImageTest = {
  sniffImageType,
  postImagePathFromUrl,
  validateOwnedImageUrl,
};

// ---------------------------------------------------------------------------
// uploadPostImage
// Uploads an image to the `post-images` bucket under the user's folder.
// Returns the public URL or { error }.
//
// Security:
//   - MIME is constrained to {image/jpeg, image/png, image/webp, image/gif}
//   - Size is capped at 5 MB
//   - Path prefix is the authenticated user's id (RLS enforces folder match)
//   - Storage bucket policies permit authenticated users to INSERT into
//     their own folder and SELECT/UPDATE/DELETE only their own objects
//     (see docs/database/003_posts.sql and 005_full_sync.sql).
//   - File extensions are sanitised to [a-z0-9] to avoid path traversal.
// ---------------------------------------------------------------------------

export async function uploadPostImage(file: File) {
  const imageErr = validateImage(file);
  if (imageErr) return { error: imageErr };

  // Content sniff: reject files whose bytes are not a real JPEG/PNG/WebP/GIF
  // even if the browser-supplied MIME says otherwise.
  const sniffed = await sniffImageType(file);
  if (!sniffed) {
    return { error: "That file doesn't look like a valid image." };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be signed in to upload an image." };

    const ext = file.type.split("/")[1] ?? "jpg";
    const safeExt = ext.replace(/[^a-z0-9]/g, "");
    const path = `${user.id}/${uniqueId()}.${safeExt}`;

    const { error } = await supabase.storage
      .from("post-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error("uploadPostImage failed:", error);
      return { error: "Couldn't upload the image. Try again." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-images").getPublicUrl(path);

    return { url: publicUrl, path };
  } catch (err) {
    console.error("uploadPostImage unexpected error:", err);
    return { error: "Couldn't upload the image. Try again." };
  }
}

// ---------------------------------------------------------------------------
// createPost
// Creates a post in a community. The author is auto-set from the session.
// ---------------------------------------------------------------------------

export async function createPost(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const communityId = String(formData.get("communityId") ?? "");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  const titleErr = validateTitle(title);
  if (titleErr) return { error: titleErr };
  const bodyErr = validateBody(body);
  if (bodyErr) return { error: bodyErr };
  if (!communityId) return { error: "Please choose a community." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a post." };

  // Posting is gated on active community membership (mirrors the 045 RLS
  // policy; surfaced here for a friendly message instead of a 42501).
  const { data: membership } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (!membership) {
    return { error: "Join the community before posting there." };
  }

  // A post's image must be a real object the user uploaded themselves.
  if (imageUrl) {
    const imgErr = validateOwnedImageUrl(imageUrl, user.id);
    if (imgErr) return { error: imgErr };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      title,
      body: body || null,
      image_url: imageUrl,
      community_id: communityId,
      author_id: user.id,
    })
    .select("id, community_id, communities:community_id(slug)")
    .maybeSingle();

  if (error) {
    console.error("createPost insert failed:", error);
    return { error: "Couldn't create the post. Try again." };
  }
  if (!post) return { error: "Post creation returned no data. Try again." };

  // Best-effort: invalidate the community feed and the home feed.
  const community = (post as unknown as {
    communities: { slug: string } | null;
  }).communities;
  revalidatePath(`/communities/${community?.slug ?? ""}`);
  revalidatePath("/home");
  revalidatePath("/");

  // Redirect to the post detail page.
  redirect(`/post/${post.id}`);
}

// ---------------------------------------------------------------------------
// editPost
// Authors can update their own posts. RLS WITH CHECK (auth.uid() = author_id)
// blocks non-authors.
// ---------------------------------------------------------------------------

export async function editPost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  // FormData cannot carry null, so image intent is explicit:
  //   removeImage=true → clear the image
  //   imageUrl=<url>   → replace the image
  //   neither          → keep the existing image
  const removeImage = String(formData.get("removeImage") ?? "") === "true";
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();

  if (!postId) return { error: "Missing post id." };
  const titleErr = validateTitle(title);
  if (titleErr) return { error: titleErr };
  const bodyErr = validateBody(body);
  if (bodyErr) return { error: bodyErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Replacement images must be real objects the caller uploaded themselves.
  if (imageUrlRaw) {
    const imgErr = validateOwnedImageUrl(imageUrlRaw, user.id);
    if (imgErr) return { error: imgErr };
  }

  const patch: Record<string, unknown> = {
    title,
    body: body || null,
    updated_at: new Date().toISOString(),
  };
  let imageChanging = false;
  const oldImageUrl = await (async () => {
    const { data: existing } = await supabase
      .from("posts")
      .select("image_url")
      .eq("id", postId)
      .maybeSingle();
    return (existing as { image_url: string | null } | null)?.image_url ?? null;
  })();

  if (removeImage) {
    patch.image_url = null;
    imageChanging = oldImageUrl !== null;
  } else if (imageUrlRaw) {
    patch.image_url = imageUrlRaw;
    imageChanging = oldImageUrl !== imageUrlRaw;
  }

  const { data: post, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", postId)
    .select("id, communities:community_id(slug)")
    .maybeSingle();

  if (error) {
    console.error("editPost update failed:", error);
    return { error: "Couldn't update the post. Try again." };
  }

  // The previous image is orphaned the moment the slot changes — delete it.
  if (imageChanging && oldImageUrl) {
    await removeAuthorPostImage(supabase, oldImageUrl, user.id);
  }

  const community = (post as unknown as {
    communities: { slug: string } | null;
  }).communities;

  revalidatePath(`/post/${postId}`);
  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/home");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// deletePost
// Authors can delete their own posts (RLS enforces this). Community admins
// can also delete via a separate RLS policy.
// ---------------------------------------------------------------------------

export async function deletePost(postId: string) {
  if (!postId) return { error: "Missing post id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Fetch the post (and its image) first so we can revalidate the feed and
  // clean up the storage object afterwards.
  const { data: post } = await supabase
    .from("posts")
    .select("id, image_url, communities:community_id(slug)")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    console.error("deletePost failed:", error);
    return { error: "Couldn't delete the post. Try again." };
  }

  // Delete the uploaded image object so it isn't left orphaned in storage.
  const imageUrl = (post as unknown as { image_url: string | null } | null)?.image_url ?? null;
  if (imageUrl) {
    await removeAuthorPostImage(supabase, imageUrl, user.id);
  }

  const community = (post as unknown as {
    communities: { slug: string } | null;
  }).communities;

  revalidatePath(`/post/${postId}`);
  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/home");

  return { ok: true };
}