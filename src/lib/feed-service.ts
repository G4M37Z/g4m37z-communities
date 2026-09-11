// ============================================================================
// src/lib/feed-service.ts
// V2 Discovery — feed / recommendation service.
// Implemented against the existing posts / communities / votes tables.
//   - trending: recent posts scored by vote balance and comment activity
//   - recommended: posts from communities the user follows + popular posts
//   - related_community: posts in communities sharing a category
// ============================================================================

import { createClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

export interface DiscoveryFeedConfig {
  type: "trending" | "recommended" | "related_community";
  communityId?: string;
  limit?: number;
}

export interface DiscoveryFeedItem {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  comment_count: number;
  score: number;
  community: { slug: string; name: string } | null;
  author: { username: string; display_name: string | null } | null;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(n)), MAX_LIMIT);
}

const BASE_SELECT =
  "id, title, body, image_url, created_at, comment_count, " +
  "community:communities!posts_community_id_fkey ( slug, name ), " +
  "author:profiles!posts_author_id_fkey ( username, display_name )";

export async function getDiscoveryFeed(
  config: DiscoveryFeedConfig,
  userId: string | null = null,
): Promise<DiscoveryFeedItem[]> {
  const supabase = await createClient();
  const limit = clamp(config.limit ?? DEFAULT_LIMIT);

  let itemIds: string[] = [];
  const scoreById = new Map<string, number>();

  if (config.type === "trending") {
    // Score = vote balance + comment activity for posts from the last 30 days.
    const { data: votes } = await supabase
      .from("post_votes")
      .select("post_id, value")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString());
    const voteMap = new Map<string, number>();
    for (const v of (votes ?? []) as { post_id: string; value: number }[]) {
      voteMap.set(v.post_id, (voteMap.get(v.post_id) ?? 0) + v.value);
    }

    const { data: posts } = await supabase
      .from("posts")
      .select("id, comment_count, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
      .limit(200);

    for (const p of (posts ?? []) as { id: string; comment_count: number; created_at: string }[]) {
      const votesFor = voteMap.get(p.id) ?? 0;
      const ageHours = Math.max(1, (Date.now() - new Date(p.created_at).getTime()) / 3600_000);
      scoreById.set(p.id, votesFor * 2 + (p.comment_count ?? 0) - Math.log2(ageHours));
    }

    if (posts) {
      itemIds = (posts as { id: string }[])
        .map((p) => p.id)
        .sort((a, b) => (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0))
        .slice(0, limit);
    }
  } else if (config.type === "recommended") {
    // Communities the user follows + popular communities, then their posts.
    let communityIds: string[] = [];
    if (userId) {
      const { data: memberships } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", userId);
      communityIds = (memberships ?? []).map((m: { community_id: string }) => m.community_id);
    }

    const { data: communities } = await supabase
      .from("communities")
      .select("id, creator_id")
      .order("created_at", { ascending: false })
      .limit(50);
    const popularIds = (communities ?? [])
      .sort((a: { creator_id: string }, b: { creator_id: string }) => b.creator_id.localeCompare(a.creator_id))
      .map((c: { id: string }) => c.id)
      .slice(0, 20);
    communityIds = [...new Set([...communityIds, ...popularIds])];

    if (communityIds.length === 0) {
      // Cold start: just newest posts.
      const { data: allPosts } = await supabase
        .from("posts")
        .select(BASE_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (allPosts as DiscoveryFeedItem[] | null) ?? [];
    }

    const { data: posts } = await supabase
      .from("posts")
      .select(BASE_SELECT)
      .in("community_id", communityIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (posts as DiscoveryFeedItem[] | null) ?? [];
  } else {
    // related_community — need the config.communityId's category set.
    if (!config.communityId) return [];
    const { data: links } = await supabase
      .from("community_category_links")
      .select("category_id")
      .eq("community_id", config.communityId);
    const categories = (links ?? []).map((l: { category_id: string }) => l.category_id);
    if (categories.length === 0) return [];

    const { data: relatedLinks } = await supabase
      .from("community_category_links")
      .select("community_id")
      .in("category_id", categories)
      .filter("community_id", "neq", config.communityId);
    const relatedCommunityIds = [...new Set((relatedLinks ?? []).map((l: { community_id: string }) => l.community_id))];
    if (relatedCommunityIds.length === 0) return [];

    const { data: posts } = await supabase
      .from("posts")
      .select(BASE_SELECT)
      .in("community_id", relatedCommunityIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (posts as DiscoveryFeedItem[] | null) ?? [];
  }

  if (itemIds.length === 0) return [];
  const { data: posts } = await supabase
    .from("posts")
    .select(BASE_SELECT)
    .in("id", itemIds);
  const rows = (posts as DiscoveryFeedItem[] | null) ?? [];
  return rows
    .map((p) => ({ ...p, score: scoreById.get(p.id) ?? 0 }))
    .sort((a, b) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0));
}