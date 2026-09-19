// ============================================================================
// src/lib/reposts/service.ts
// V5 — Reposts (share-to-feed). Migration 033 schema.
//
// Security model:
//   - Identity always resolved server-side from the cookie-bound session;
//     clients never supply reposter_id / original_author_id.
//   - Reads use the request-scoped client (reposts_select is public);
//     writes use the same client — RLS enforces reposter_id = auth.uid()
//     and original_author_id = posts.author_id (no spoofed attribution).
//   - Duplicate prevention: unique (reposter_id, post_id); 23505 treated as
//     idempotent success.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_MAX = 280;

export interface RepostRow {
  id: string;
  reposter_id: string;
  post_id: string;
  original_author_id: string;
  comment: string | null;
  created_at: string;
}

export type RepostResult =
  | { ok: true; status: "created" | "already" }
  | { ok: false; status: "invalid" | "forbidden" | "not_found" | "error"; error: string };

export type UnrepostResult =
  | { ok: true; status: "removed" | "absent" }
  | { ok: false; status: "invalid" | "error"; error: string };

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function validateRepostComment(comment: string | null | undefined): {
  ok: boolean;
  comment: string | null;
  error?: string;
} {
  // A null/empty comment is a plain repost and is VALID (the column is
  // nullable). Only an over-length quip is invalid.
  const trimmed = String(comment ?? "").trim();
  if (trimmed.length > COMMENT_MAX) {
    return { ok: false, comment: null, error: `Comment must be ${COMMENT_MAX} characters or fewer.` };
  }
  return { ok: true, comment: trimmed.length > 0 ? trimmed : null };
}

/** Create a repost (share-to-feed). Idempotent per (user, post). */
export async function createRepost(
  postId: string,
  comment: string | null = null
): Promise<RepostResult> {
  if (!isUuid(postId)) {
    return { ok: false, status: "invalid", error: "Invalid post." };
  }
  const checked = validateRepostComment(comment);
  if (!checked.ok) {
    return { ok: false, status: "invalid", error: checked.error ?? "Invalid comment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: "forbidden", error: "Not signed in." };
  }

  // Original post must exist and be readable (RLS filters private-community
  // posts automatically).
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    return { ok: false, status: "not_found", error: "Post not found." };
  }

  const { error } = await supabase.from("reposts").insert({
    reposter_id: user.id,
    post_id: postId,
    original_author_id: post.author_id,
    comment: checked.comment,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, status: "already" };
    if (error.code === "42501") {
      return { ok: false, status: "forbidden", error: "You can't repost this." };
    }
    return { ok: false, status: "error", error: "Could not repost." };
  }
  return { ok: true, status: "created" };
}

/** Remove this user's repost of a post. */
export async function removeRepost(postId: string): Promise<UnrepostResult> {
  if (!isUuid(postId)) {
    return { ok: false, status: "invalid", error: "Invalid post." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: "invalid", error: "Not signed in." };
  }
  const { error } = await supabase
    .from("reposts")
    .delete()
    .eq("reposter_id", user.id)
    .eq("post_id", postId);
  if (error) {
    return { ok: false, status: "error", error: "Could not undo repost." };
  }
  return { ok: true, status: "removed" };
}

/** Repost count for a post. */
export async function getRepostCount(postId: string): Promise<number> {
  if (!isUuid(postId)) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("reposts")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  return count ?? 0;
}

/** Did the current user repost this post? (null = signed out) */
export async function hasReposted(postId: string): Promise<boolean | null> {
  if (!isUuid(postId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("reposts")
    .select("id")
    .eq("reposter_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Feed integration: reposts made by a set of users (their own profile feed /
 * followed-users feed), newest first, with the original post embedded.
 */
export async function listRepostsByUsers(
  userIds: string[],
  limit = 20
): Promise<
  Array<{
    repost: RepostRow;
    post: {
      id: string;
      title: string;
      body: string | null;
      image_url: string | null;
      created_at: string;
      comment_count: number;
    };
  }>
> {
  if (userIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reposts")
    .select(
      `id, reposter_id, post_id, original_author_id, comment, created_at,
       post:posts!reposts_post_id_fkey ( id, title, body, image_url, created_at, comment_count )`
    )
    .in("reposter_id", userIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row: unknown) => {
    const r = row as {
      id: string;
      reposter_id: string;
      post_id: string;
      original_author_id: string;
      comment: string | null;
      created_at: string;
      post: {
        id: string;
        title: string;
        body: string | null;
        image_url: string | null;
        created_at: string;
        comment_count: number;
      } | null;
    };
    return {
      repost: {
        id: r.id,
        reposter_id: r.reposter_id,
        post_id: r.post_id,
        original_author_id: r.original_author_id,
        comment: r.comment,
        created_at: r.created_at,
      },
      post: r.post ?? {
        id: r.post_id,
        title: "[deleted post]",
        body: null,
        image_url: null,
        created_at: r.created_at,
        comment_count: 0,
      },
    };
  });
}
