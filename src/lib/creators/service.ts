// ============================================================================
// src/lib/creators/service.ts
// V3.7 — Creators service (full implementation).
//
// Security model:
//   - Reads use the request-scoped Supabase client; RLS (019) allows public
//     SELECT on all three creator tables.
//   - Writes go through createAdminClient (service_role) with the acting
//     user's identity resolved server-side via auth.getUser(). Clients never
//     supply user_id or creator_id.
//   - Defence-in-depth: even though the admin client bypasses RLS, every
//     mutation re-checks ownership against the resolved uid:
//       create/update profile      -> uid == user_id (PK of the profile row)
//       create/update/delete content -> uid == creator_id
//       follow / unfollow          -> uid is the follower; target != uid
//   - Denormalised counters (follower_count / total_content) are written by
//     the service because they live on the creator's own row, which a follower
//     may never UPDATE (RLS 019 is self-scoped on creator_profiles).
//   - Pure input-validation / verdict helpers are exported through `__test`
//     for deterministic unit tests; DB paths need the live DB at integration
//     time (see tests/creators-service.test.ts).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_PROFILE_BIO_LEN = 2000;
export const MAX_DISPLAY_NAME_LEN = 80;
export const MAX_CONTENT_TITLE_LEN = 160;
export const MAX_CONTENT_BODY_LEN = 8000;
export const MAX_MEDIA_URL_LEN = 2000;
export const MAX_PAGE = 50;
export const MAX_QUERY_LEN = 64;

export const CONTENT_TYPES = ["post", "clip", "guide", "review"] as const;
export type CreatorContentType = (typeof CONTENT_TYPES)[number];

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  bio: string | null;
  verified: boolean;
  follower_count: number;
  total_content: number;
  created_at: string;
}

export interface CreatorContent {
  id: string;
  creator_id: string;
  content_type: string;
  title: string;
  game_id: string | null;
  body: string | null;
  media_url: string | null;
  published: boolean;
  view_count: number;
  created_at: string;
}

export type CreatorResult =
  | {
      ok: true;
      status: "inserted" | "updated" | "deleted" | "followed" | "unfollowed" | "duplicate";
      user_id?: string;
      content_id?: string;
    }
  | { ok: false; status: "error" | "not_found" | "forbidden" | "self" | "duplicate" | "invalid"; error: string };

// ---------------------------------------------------------------------------
// Pure input validation & verdicts (unit-testable — exported via __test)
// ---------------------------------------------------------------------------

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface ProfileInput {
  displayName?: string;
  bio?: string;
}

export function validateProfileInput(input: ProfileInput): { ok: true; value: ProfileInput } | { ok: false; error: string } {
  const displayName = input.displayName?.trim();
  const bio = input.bio?.trim();

  if (displayName !== undefined && displayName !== "") {
    if (displayName.length > MAX_DISPLAY_NAME_LEN) {
      return { ok: false, error: "Display name is too long." };
    }
  }
  if (bio !== undefined && bio.length > MAX_PROFILE_BIO_LEN) {
    return { ok: false, error: "Bio is too long." };
  }

  return { ok: true, value: { displayName, bio } };
}

export interface ContentInput {
  contentType: string;
  title: string;
  gameId?: string;
  body?: string;
  mediaUrl?: string;
  published?: boolean;
}

export function validateContentInput(input: ContentInput): { ok: true; value: ContentInput } | { ok: false; error: string } {
  if (!CONTENT_TYPES.includes(input.contentType as CreatorContentType)) {
    return { ok: false, error: `contentType must be one of: ${CONTENT_TYPES.join(", ")}` };
  }
  const title = input.title.trim();
  if (title.length === 0) {
    return { ok: false, error: "Title is required." };
  }
  if (title.length > MAX_CONTENT_TITLE_LEN) {
    return { ok: false, error: "Title is too long." };
  }
  if (input.gameId !== undefined && !isUuid(input.gameId)) {
    return { ok: false, error: "gameId must be a valid UUID." };
  }
  if (input.body !== undefined && input.body.length > MAX_CONTENT_BODY_LEN) {
    return { ok: false, error: "Body is too long." };
  }
  if (input.mediaUrl !== undefined && input.mediaUrl.length > MAX_MEDIA_URL_LEN) {
    return { ok: false, error: "Media URL is too long." };
  }

  return {
    ok: true,
    value: {
      contentType: input.contentType,
      title,
      gameId: input.gameId?.trim() || undefined,
      body: input.body?.trim() || undefined,
      mediaUrl: input.mediaUrl?.trim() || undefined,
      published: input.published ?? false,
    },
  };
}

export type FollowVerdict = "ok" | "self" | "duplicate" | "not_found";

export function followVerdict(profileExists: boolean, isSelf: boolean, alreadyFollowing: boolean): FollowVerdict {
  if (!profileExists) return "not_found";
  if (isSelf) return "self";
  if (alreadyFollowing) return "duplicate";
  return "ok";
}

// ---------------------------------------------------------------------------
// Reads — public RLS (019): everyone may SELECT creator tables
// ---------------------------------------------------------------------------

export async function listCreators(opts: { search?: string; verifiedOnly?: boolean; limit?: number } = {}): Promise<CreatorProfile[]> {
  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 24, 1, MAX_PAGE);

  let query = supabase
    .from("creator_profiles")
    .select("user_id, display_name, bio, verified, follower_count, total_content, created_at")
    .order("follower_count", { ascending: false })
    .limit(limit);

  const search = opts.search?.trim().slice(0, MAX_QUERY_LEN);
  if (search) {
    // ilike on display_name (text) — see docs/database/019_creators_policies.sql
    query = query.ilike("display_name", `%${search}%`);
  }
  if (opts.verifiedOnly) {
    query = query.eq("verified", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CreatorProfile[];
}

export async function getCreator(userId: string): Promise<{ profile: CreatorProfile | null; error?: string }> {
  if (!isUuid(userId)) return { profile: null, error: "Invalid user id." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("user_id, display_name, bio, verified, follower_count, total_content, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { profile: null, error: error.message };
  return { profile: (data as CreatorProfile | null) ?? null };
}

export async function getCreatorContent(
  userId: string,
  opts: { publishedOnly?: boolean; limit?: number } = {},
): Promise<CreatorContent[]> {
  if (!isUuid(userId)) return [];

  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 24, 1, MAX_PAGE);

  let query = supabase
    .from("creator_content")
    .select("id, creator_id, content_type, title, game_id, body, media_url, published, view_count, created_at")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.publishedOnly) {
    query = query.eq("published", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CreatorContent[];
}

export async function isFollowingCreator(userId: string, viewerId?: string | null): Promise<boolean> {
  if (!isUuid(userId) || !viewerId || !isUuid(viewerId)) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_followers")
    .select("user_id")
    .eq("creator_id", userId)
    .eq("user_id", viewerId)
    .maybeSingle();

  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Mutations — admin client with server-side ownership re-checks
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<{ uid: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { uid: null, error: "Not signed in." };
  return { uid: user.id };
}

export async function createCreatorProfile(input: ProfileInput): Promise<CreatorResult> {
  const verdict = validateProfileInput(input);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const admin = await createAdminClient();
  const { error } = await admin.from("creator_profiles").upsert({
    user_id: uid,
    display_name: verdict.value.displayName || null,
    bio: verdict.value.bio || null,
  });
  if (error) return { ok: false, status: "error", error: error.message };

  return { ok: true, status: "inserted", user_id: uid };
}

export async function updateCreatorProfile(input: ProfileInput): Promise<CreatorResult> {
  const verdict = validateProfileInput(input);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const admin = await createAdminClient();
  const patch: Record<string, string> = {};
  if (verdict.value.displayName !== undefined) patch.display_name = verdict.value.displayName;
  if (verdict.value.bio !== undefined) patch.bio = verdict.value.bio;
  if (Object.keys(patch).length === 0) return { ok: true, status: "updated", user_id: uid };

  const { error } = await admin
    .from("creator_profiles")
    .update(patch)
    .eq("user_id", uid);
  if (error) return { ok: false, status: "error", error: error.message };

  return { ok: true, status: "updated", user_id: uid };
}

export async function publishCreatorContent(input: ContentInput): Promise<CreatorResult> {
  const verdict = validateContentInput(input);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from("creator_profiles")
    .select("user_id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!profile) return { ok: false, status: "not_found", error: "Creator profile not found." };

  const { data: inserted, error } = await admin
    .from("creator_content")
    .insert({
      creator_id: uid,
      content_type: verdict.value.contentType,
      title: verdict.value.title,
      game_id: verdict.value.gameId ?? null,
      body: verdict.value.body ?? null,
      media_url: verdict.value.mediaUrl ?? null,
      published: verdict.value.published,
    })
    .select("id")
    .single();
  if (error) return { ok: false, status: "error", error: error.message };

  await bumpTotalContent(uid, 1);

  return { ok: true, status: "inserted", user_id: uid, content_id: inserted.id };
}

export async function updateCreatorContent(contentId: string, input: ContentInput): Promise<CreatorResult> {
  if (!isUuid(contentId)) return { ok: false, status: "invalid", error: "Invalid content id." };

  const verdict = validateContentInput(input);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const admin = await createAdminClient();

  const { data: existing } = await admin
    .from("creator_content")
    .select("creator_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!existing) return { ok: false, status: "not_found", error: "Content not found." };
  if (existing.creator_id !== uid) return { ok: false, status: "forbidden", error: "You can only edit your own content." };

  const { error } = await admin
    .from("creator_content")
    .update({
      content_type: verdict.value.contentType,
      title: verdict.value.title,
      game_id: verdict.value.gameId ?? null,
      body: verdict.value.body ?? null,
      media_url: verdict.value.mediaUrl ?? null,
      published: verdict.value.published,
    })
    .eq("id", contentId);
  if (error) return { ok: false, status: "error", error: error.message };

  return { ok: true, status: "updated", user_id: uid, content_id: contentId };
}

export async function deleteCreatorContent(contentId: string): Promise<CreatorResult> {
  if (!isUuid(contentId)) return { ok: false, status: "invalid", error: "Invalid content id." };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const admin = await createAdminClient();

  const { data: existing } = await admin
    .from("creator_content")
    .select("creator_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!existing) return { ok: false, status: "not_found", error: "Content not found." };
  if (existing.creator_id !== uid) return { ok: false, status: "forbidden", error: "You can only delete your own content." };

  const { error } = await admin.from("creator_content").delete().eq("id", contentId);
  if (error) return { ok: false, status: "error", error: error.message };

  await bumpTotalContent(uid, -1);

  return { ok: true, status: "deleted", user_id: uid, content_id: contentId };
}

export async function followCreator(userId: string): Promise<CreatorResult> {
  return setCreatorFollowing(userId, true);
}

export async function unfollowCreator(userId: string): Promise<CreatorResult> {
  return setCreatorFollowing(userId, false);
}

async function setCreatorFollowing(userId: string, shouldFollow: boolean): Promise<CreatorResult> {
  if (!isUuid(userId)) return { ok: false, status: "invalid", error: "Invalid user id." };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };
  if (uid === userId) return { ok: false, status: "self", error: "You cannot follow yourself." };

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from("creator_profiles")
    .select("user_id, follower_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, status: "not_found", error: "Creator profile not found." };

  const { data: existing } = await admin
    .from("creator_followers")
    .select("user_id")
    .eq("creator_id", userId)
    .eq("user_id", uid)
    .maybeSingle();

  if (shouldFollow) {
    if (existing) return { ok: false, status: "duplicate", error: "Already following this creator." };

    const { error: insertError } = await admin.from("creator_followers").insert({ creator_id: userId, user_id: uid });
    if (insertError) {
      // 23505 = unique_violation on (creator_id, user_id)
      if (insertError.code === "23505") return { ok: false, status: "duplicate", error: "Already following this creator." };
      return { ok: false, status: "error", error: insertError.message };
    }

    const next = Math.max(0, (profile.follower_count ?? 0) + 1);
    const { error: bumpError } = await admin
      .from("creator_profiles")
      .update({ follower_count: next })
      .eq("user_id", userId);
    if (bumpError) return { ok: false, status: "error", error: bumpError.message };

    return { ok: true, status: "followed", user_id: userId };
  }

  if (!existing) return { ok: false, status: "duplicate", error: "Not following this creator." };

  const { error: deleteError } = await admin
    .from("creator_followers")
    .delete()
    .eq("creator_id", userId)
    .eq("user_id", uid);
  if (deleteError) return { ok: false, status: "error", error: deleteError.message };

  const next = Math.max(0, (profile.follower_count ?? 0) - 1);
  const { error: bumpError } = await admin
    .from("creator_profiles")
    .update({ follower_count: next })
    .eq("user_id", userId);
  if (bumpError) return { ok: false, status: "error", error: bumpError.message };

  return { ok: true, status: "unfollowed", user_id: userId };
}

async function bumpTotalContent(userId: string, delta: number): Promise<void> {
  const admin = await createAdminClient();
  const { data: profile } = await admin
    .from("creator_profiles")
    .select("total_content")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return;
  const next = Math.max(0, (profile.total_content ?? 0) + delta);
  await admin.from("creator_profiles").update({ total_content: next }).eq("user_id", userId);
}

export const __test = {
  isUuid,
  clamp,
  MAX_PAGE,
  MAX_QUERY_LEN,
  MAX_PROFILE_BIO_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_CONTENT_TITLE_LEN,
  MAX_CONTENT_BODY_LEN,
  MAX_MEDIA_URL_LEN,
  validateProfileInput,
  validateContentInput,
  followVerdict,
};