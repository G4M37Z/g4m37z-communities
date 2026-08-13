// ============================================================================
// src/lib/search/queries.ts
// Read-only search across communities, posts, users. Server-side only.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  communities: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon_url: string | null;
    member_count: number;
  }>;
  posts: Array<{
    id: string;
    title: string;
    body: string | null;
    created_at: string;
    community: { slug: string; name: string } | null;
    author: { username: string } | null;
    comment_count: number;
    score: number;
  }>;
  users: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
}

const PER_TYPE_LIMIT = 8;
const MAX_QUERY_LENGTH = 100;

/**
 * Sanitize and validate the search query. Returns null if the query is empty.
 * Escapes `%` and `_` so they're treated literally in ILIKE patterns.
 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Run a federated search across communities, posts, and users. Each result
 * is bounded by PER_TYPE_LIMIT. Empty query returns empty arrays.
 */
export async function searchAll(rawQuery: string): Promise<SearchResult> {
  const empty: SearchResult = { communities: [], posts: [], users: [] };
  const q = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length === 0) return empty;

  const supabase = await createClient();
  const pattern = `%${escapeLike(q)}%`;

  // Run three searches in parallel.
  const [{ data: communities }, { data: posts }, { data: users }] =
    await Promise.all([
      supabase
        .from("communities")
        .select(
          "id, name, slug, description, icon_url, created_at"
        )
        .or(
          `name.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern}`
        )
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT),

      supabase
        .from("posts")
        .select(
          `id, title, body, created_at, comment_count,
           author:profiles!posts_author_id_fkey ( username ),
           community:communities!posts_community_id_fkey ( slug, name )`
        )
        .or(`title.ilike.${pattern},body.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT),

      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, created_at")
        .or(
          `username.ilike.${pattern},display_name.ilike.${pattern}`
        )
        .order("created_at", { ascending: false })
        .limit(PER_TYPE_LIMIT),
    ]);

  // For communities, fetch member counts separately (PostgREST can't join an
  // aggregate in a single select). One IN-query, then merge.
  const communityIds = (communities ?? []).map(
    (c: { id: string }) => c.id
  );
  const memberCountByCommunity = new Map<string, number>();
  if (communityIds.length > 0) {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .in("community_id", communityIds);
    for (const m of (memberships ?? []) as { community_id: string }[]) {
      memberCountByCommunity.set(
        m.community_id,
        (memberCountByCommunity.get(m.community_id) ?? 0) + 1
      );
    }
  }

  // For posts, fetch vote scores.
  const postIds = (posts ?? []).map((p: { id: string }) => p.id);
  const scoreByPost = new Map<string, number>();
  if (postIds.length > 0) {
    const { data: votes } = await supabase
      .from("post_votes")
      .select("post_id, value")
      .in("post_id", postIds);
    for (const v of (votes ?? []) as { post_id: string; value: number }[]) {
      scoreByPost.set(
        v.post_id,
        (scoreByPost.get(v.post_id) ?? 0) + v.value
      );
    }
  }

  return {
    communities: ((communities ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      icon_url: string | null;
    }>).map((c) => ({
      ...c,
      member_count: memberCountByCommunity.get(c.id) ?? 0,
    })),
    posts: ((posts ?? []) as Array<{
      id: string;
      title: string;
      body: string | null;
      created_at: string;
      comment_count: number;
      author: { username: string } | { username: string }[] | null;
      community: { slug: string; name: string } | { slug: string; name: string }[] | null;
    }>).map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      created_at: p.created_at,
      comment_count: p.comment_count ?? 0,
      author: Array.isArray(p.author) ? p.author[0] ?? null : p.author,
      community: Array.isArray(p.community)
        ? p.community[0] ?? null
        : p.community,
      score: scoreByPost.get(p.id) ?? 0,
    })),
    users: (users ?? []) as SearchResult["users"],
  };
}