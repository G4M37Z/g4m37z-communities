// ============================================================================
// src/lib/communities/actions.ts
// Server Actions for the Communities feature (Milestone 3).
//
// All mutations run through the cookie-bound Supabase client so RLS continues
// to enforce ownership (auth.uid() = creator_id, auth.uid() = user_id).
// ============================================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CommunityMember } from "@/types/database";

// ---------------------------------------------------------------------------
// Slug + name validation
// ---------------------------------------------------------------------------

function validateSlug(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (s.length < 3) return "Slug must be at least 3 characters.";
  if (s.length > 40) return "Slug must be 40 characters or fewer.";
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)) {
    return "Slug may only contain lowercase letters, numbers, and hyphens, and must start and end with a letter or number.";
  }
  return null;
}

function validateName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return "Name must be at least 3 characters.";
  if (n.length > 60) return "Name must be 60 characters or fewer.";
  return null;
}

function validateDescription(desc: string): string | null {
  const d = desc.trim();
  if (d.length > 500) return "Description must be 500 characters or fewer.";
  return null;
}

// ---------------------------------------------------------------------------
// createCommunity
// Creates a new community. The DB trigger handle_new_community adds the
// creator as an 'admin' member automatically.
// ---------------------------------------------------------------------------

export async function createCommunity(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);

  const nameErr = validateName(name);
  if (nameErr) return { error: nameErr };
  const slugErr = validateSlug(slug);
  if (slugErr) return { error: slugErr };
  const descErr = validateDescription(description);
  if (descErr) return { error: descErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to create a community." };

  // Insert community — RLS WITH CHECK (auth.uid() = creator_id) enforces ownership.
  const { data: community, error } = await supabase
    .from("communities")
    .insert({
      name,
      slug,
      description: description || null,
      creator_id: user.id,
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { error: "That slug is already taken. Try a different one." };
    }
    console.error("createCommunity insert failed:", error);
    return { error: error.message || "We couldn't create the community. Try again." };
  }

  if (!community) {
    return { error: "Community creation returned no data. Try again." };
  }

  // Tag the community with selected categories. The trigger already added
  // the creator as admin; categories are optional.
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((categoryId) => ({
      community_id: community.id,
      category_id: categoryId,
    }));
    const { error: tagErr } = await supabase
      .from("community_category_links")
      .insert(rows);
    if (tagErr) {
      // Non-fatal — community exists, categories can be added later.
      console.error("createCommunity category tagging failed:", tagErr);
    }
  }

  revalidatePath("/communities");
  redirect(`/communities/${community.slug}`);
}

// ---------------------------------------------------------------------------
// joinCommunity / leaveCommunity
// Self-service membership management. RLS WITH CHECK (auth.uid() = user_id)
// keeps users from joining on behalf of others.
// ---------------------------------------------------------------------------

export async function joinCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!communityId) return { error: "Invalid community." };

  // Idempotent join. `ignoreDuplicates` => ON CONFLICT DO NOTHING on the
  // (community_id, user_id) PK, so re-joining is a no-op and the creator's
  // auto-created 'admin' row (handle_new_community, migration 036) is never
  // demoted to 'member'.
  const attempt = () =>
    supabase.from("community_members").upsert(
      { community_id: communityId, user_id: user.id, role: "member" },
      { onConflict: "community_id,user_id", ignoreDuplicates: true }
    );

  let { error } = await attempt();

  // FK 23503: the caller has no public.profiles row, and every membership
  // table foreign-keys to profiles. Self-heal with the self-only RPC and retry.
  if (error?.code === "23503") {
    const { error: ensureErr } = await supabase.rpc("ensure_profile");
    if (!ensureErr) {
      ({ error } = await attempt());
    }
  }

  if (error && error.code !== "23505") {
    console.error("joinCommunity failed:", error);
    return { error: "Couldn't join the community. Try again." };
  }

  return { ok: true };
}

export async function leaveCommunity(communityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Refuse to leave if the user is the only admin of the community — that
  // would orphan the community with no one able to manage it. Admin can
  // promote someone else first (Milestone 8) or delete the community.
  const { data: membership } = await supabase
    .from("community_members")
    .select("role")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role === "admin") {
    const { count } = await supabase
      .from("community_members")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return {
        error:
          "You're the only admin. Promote another member to admin first, or delete the community.",
      };
    }
  }

  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id);

  if (error) {
    console.error("leaveCommunity failed:", error);
    return { error: "Couldn't leave the community. Try again." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// getCommunityMembership
// Returns the current user's membership row for a community, or null.
// ---------------------------------------------------------------------------

export async function getCommunityMembership(
  communityId: string
): Promise<CommunityMember | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("community_members")
    .select("community_id, user_id, role, joined_at")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as CommunityMember | null) ?? null;
}

// ---------------------------------------------------------------------------
// checkSlugAvailability
// Used by the create form for live slug validation.
// ---------------------------------------------------------------------------

export async function checkSlugAvailability(slug: string) {
  const slugErr = validateSlug(slug);
  if (slugErr) return { available: false, reason: slugErr };
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select("slug")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (data) return { available: false, reason: "That slug is already taken." };
  return { available: true };
}
// ============================================================================
// saveCapabilities
// V4: persists the community capabilities[] toggle set from the settings page.
// RLS "Moderators can update community settings" (026) gates the update.
// ============================================================================

const ALLOWED_CAPABILITY_IDS = new Set([
  "discussions",
  "media",
  "members",
  "voice",
  "events",
  "polls",
]);

export type SaveCapabilitiesResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveCapabilities(
  communityId: string,
  enabled: string[],
): Promise<SaveCapabilitiesResult> {
  if (!Array.isArray(enabled) || enabled.some((id) => !ALLOWED_CAPABILITY_IDS.has(id))) {
    return { ok: false, error: "Invalid capabilities." };
  }
  if (new Set(enabled).size !== enabled.length) {
    return { ok: false, error: "Duplicate capabilities." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("communities")
    .update({ capabilities: enabled, updated_at: new Date().toISOString() })
    .eq("id", communityId);
  if (error) return { ok: false, error: "Could not save capabilities." };

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", communityId)
    .maybeSingle();
  const slug = (community as { slug: string } | null)?.slug;
  if (slug) {
    revalidatePath(`/communities/${slug}/settings`);
    revalidatePath(`/communities/${slug}`);
  }
  return { ok: true };
}
// ---------------------------------------------------------------------------
// togglePrivacy
// Toggles the is_private flag on a community. Only moderators/admins may do
// this. RLS "Moderators can update community settings" (026) already gates
// row-level updates to the creator or moderators/admins.
// ---------------------------------------------------------------------------

export type TogglePrivacyResult = { ok: true; is_private: boolean } | { ok: false; error: string };

export async function togglePrivacy(
  communityId: string,
): Promise<TogglePrivacyResult> {
  if (!communityId) return { ok: false, error: "Invalid community." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("communities")
    .select("is_private, slug")
    .eq("id", communityId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Community not found." };

  const current = Boolean((existing as { is_private: boolean }).is_private);
  const next = !current;

  const { error } = await supabase
    .from("communities")
    .update({ is_private: next, updated_at: new Date().toISOString() })
    .eq("id", communityId);
  if (error) return { ok: false, error: "Could not update privacy." };

  const slug = (existing as { slug: string }).slug;
  revalidatePath(`/communities/${slug}/settings`);
  revalidatePath(`/communities/${slug}`);
  return { ok: true, is_private: next };
}

// ---------------------------------------------------------------------------
// deleteCommunity
// Deletes a community. RLS "Creator can delete own community" gates this to
// the creator only (auth.uid() = creator_id). All child rows (members, posts,
// events, voice rooms, category links) cascade at the FK level — verified.
// Community media objects are cleaned up best-effort (bucket policies from
// migration 034 permit the creator).
// ---------------------------------------------------------------------------

export type DeleteCommunityResult = { ok: true } | { ok: false; error: string };

export async function deleteCommunity(
  communityId: string,
): Promise<DeleteCommunityResult> {
  if (!communityId) return { ok: false, error: "Invalid community." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("communities")
    .select("slug, creator_id")
    .eq("id", communityId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Community not found." };
  if (existing.creator_id !== user.id) {
    // RLS would deny this anyway — surface it explicitly.
    return { ok: false, error: "Only the community creator can delete it." };
  }

  // Best-effort media cleanup first (034 policies allow the creator).
  try {
    const { data: objects } = await supabase.storage
      .from("community-media")
      .list(communityId, { limit: 20 });
    if (objects && objects.length > 0) {
      await supabase.storage
        .from("community-media")
        .remove(objects.map((o: { name: string }) => `${communityId}/${o.name}`));
    }
  } catch {
    // non-fatal: media cleanup failure must not block deletion
  }

  const { error } = await supabase
    .from("communities")
    .delete()
    .eq("id", communityId);
  if (error) return { ok: false, error: "Could not delete the community." };

  revalidatePath("/communities");
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// uploadCommunityMedia
// Uploads a community icon or banner into the community-media bucket under
// {communityId}/{kind}.{ext}. Authorization: caller must be the creator or a
// moderator/admin (storage RLS from 034 enforces the same server-side).
// ---------------------------------------------------------------------------

const CM_MAX_BYTES = 5 * 1024 * 1024;
const CM_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function cmSafeExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}

export type CommunityMediaResult =
  | { ok: true; url: string; kind: "icon" | "banner" }
  | { ok: false; error: string };

export async function uploadCommunityMedia(
  formData: FormData
): Promise<CommunityMediaResult> {
  const kindRaw = String(formData.get("kind") ?? "");
  if (kindRaw !== "icon" && kindRaw !== "banner") {
    return { ok: false, error: "Invalid media kind." };
  }
  const kind: "icon" | "banner" = kindRaw;

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file uploaded." };
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > CM_MAX_BYTES) return { ok: false, error: "Image must be 5 MB or smaller." };
  if (!CM_ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Image must be JPEG, PNG, WebP, or GIF." };
  }

  const communityId = String(formData.get("communityId") ?? "");
  if (!communityId) return { ok: false, error: "Invalid community." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Authorization: creator or moderator/admin (mirrors storage RLS).
  const { data: ctx } = await supabase
    .from("communities")
    .select(
      "slug, creator_id, community_members!left(role)"
    )
    .eq("id", communityId)
    .maybeSingle();
  const community = ctx as
    | { slug: string; creator_id: string; community_members: { role: string }[] | null }
    | null;
  if (!community) return { ok: false, error: "Community not found." };

  const isCreator = community.creator_id === user.id;
  const isMod = (community.community_members ?? []).some(
    (m) => m.role === "admin" || m.role === "moderator"
  );
  if (!isCreator && !isMod) {
    return { ok: false, error: "Only the creator or moderators can change community media." };
  }

  const path = `${communityId}/${kind}.${cmSafeExt(file.type)}`;
  const { error: uploadErr } = await supabase.storage
    .from("community-media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
  if (uploadErr) {
    console.error("uploadCommunityMedia failed:", uploadErr);
    const msg = uploadErr.message?.toLowerCase().includes("bucket")
      ? "Storage is not configured yet. Please contact support."
      : "Couldn't upload the image. Try again.";
    return { ok: false, error: msg };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("community-media").getPublicUrl(path);
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  const column = kind === "icon" ? "icon_url" : "banner_url";
  const { error: updateErr } = await supabase
    .from("communities")
    .update({ [column]: versionedUrl, updated_at: new Date().toISOString() })
    .eq("id", communityId);
  if (updateErr) {
    console.error("community media url update failed:", updateErr);
    return { ok: false, error: "Image uploaded but the community update failed." };
  }

  revalidatePath(`/communities/${community.slug}`);
  revalidatePath(`/communities/${community.slug}/settings`);
  revalidatePath("/communities");
  return { ok: true, url: versionedUrl, kind };
}
