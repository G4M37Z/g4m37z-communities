// ============================================================================
// src/lib/bookmarks/service.ts
// V5 — Bookmarks (private saved content).
//
// Security model:
//   - All reads/writes use the request-scoped cookie-bound client.
//     RLS (032) scopes bookmarks to user_id = auth.uid(); another user's
//     saved list is invisible and unwritable by design. No admin client.
//   - Identity always from the session — clients never supply user_id.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SavedPost {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  comment_count: number;
  saved_at: string;
  author: { username: string; display_name: string | null } | null;
  community: { slug: string; name: string } | null;
}

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/** Is this post bookmarked by the current user? (null = signed out) */
export async function isBookmarked(postId: string): Promise<boolean | null> {
  if (!isUuid(postId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();
  return Boolean(data);
}

/** Idempotent bookmark add. Returns false when signed out. */
export async function addBookmark(postId: string): Promise<boolean> {
  if (!isUuid(postId)) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("bookmarks")
    .insert({ user_id: user.id, post_id: postId });
  // 23505 = already bookmarked → idempotent success.
  if (error && error.code !== "23505") {
    console.error("addBookmark failed:", error);
    return false;
  }
  return true;
}

/** Idempotent bookmark removal. Returns false when signed out. */
export async function removeBookmark(postId: string): Promise<boolean> {
  if (!isUuid(postId)) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("post_id", postId);
  if (error) {
    console.error("removeBookmark failed:", error);
    return false;
  }
  return true;
}

/**
 * The caller's saved posts, newest-saved first, with author/community embeds.
 * RLS guarantees only the caller's rows are visible.
 */
export async function listSavedPosts(
  limit = 30,
  offset = 0
): Promise<{ items: SavedPost[]; total: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], total: null };

  const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), 50);
  const cappedOffset = Math.max(0, Math.floor(offset));

  const [{ data, error }, { count }] = await Promise.all([
    supabase
      .from("bookmarks")
      .select(
        `post_id, created_at,
         posts:post_id (
           id, title, body, image_url, created_at, comment_count,
           author:profiles!posts_author_id_fkey ( username, display_name ),
           community:communities!posts_community_id_fkey ( slug, name )
         )`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(cappedOffset, cappedOffset + cappedLimit - 1),
    supabase
      .from("bookmarks")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  if (error) {
    console.error("listSavedPosts failed:", error);
    return { items: [], total: typeof count === "number" ? count : null };
  }

  type JoinedPost = Omit<SavedPost, "saved_at"> & {
    author: SavedPost["author"] | SavedPost["author"][];
    community: SavedPost["community"] | SavedPost["community"][];
  };
  type Row = { post_id: string; created_at: string; posts: JoinedPost | JoinedPost[] | null };

  const items: SavedPost[] = ((data ?? []) as unknown as Row[])
    .map((r) => {
      const p = Array.isArray(r.posts) ? r.posts[0] : r.posts;
      if (!p || typeof p !== "object" || !("id" in p)) return null;
      return {
        ...p,
        author: Array.isArray(p.author) ? (p.author[0] ?? null) : p.author,
        community: Array.isArray(p.community)
          ? (p.community[0] ?? null)
          : p.community,
        saved_at: r.created_at,
      } satisfies SavedPost;
    })
    .filter((x): x is SavedPost => x !== null);

  return { items, total: typeof count === "number" ? count : null };
}
