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

function validateImage(file: File): string | null {
  if (file.size === 0) return "Image file is empty.";
  if (file.size > IMAGE_MAX_BYTES) return "Image must be 5 MB or smaller.";
  if (!IMAGE_MIME.includes(file.type)) {
    return "Image must be JPEG, PNG, WebP, or GIF.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// uploadPostImage
// Uploads an image to the `post-images` bucket under the user's folder.
// Returns the public URL or { error }.
// ---------------------------------------------------------------------------

export async function uploadPostImage(file: File) {
  const imageErr = validateImage(file);
  if (imageErr) return { error: imageErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to upload an image." };

  const ext = file.type.split("/")[1] ?? "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${crypto.randomUUID()}.${safeExt}`;

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
  const imageUrlRaw = String(formData.get("imageUrl") ?? "");
  // null = keep existing image; "" = remove image; otherwise replace.
  const imageUrl: string | null | undefined =
    imageUrlRaw === "" ? undefined : imageUrlRaw.trim() || null;

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

  const patch: Record<string, unknown> = {
    title,
    body: body || null,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl !== undefined) patch.image_url = imageUrl;

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

  // Fetch the community slug first so we can revalidate the feed.
  const { data: post } = await supabase
    .from("posts")
    .select("id, communities:community_id(slug)")
    .eq("id", postId)
    .maybeSingle();

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    console.error("deletePost failed:", error);
    return { error: "Couldn't delete the post. Try again." };
  }

  const community = (post as unknown as {
    communities: { slug: string } | null;
  }).communities;

  revalidatePath(`/post/${postId}`);
  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/home");

  return { ok: true };
}