// ============================================================================
// src/lib/posts/queries.ts
// Read-only query helpers for posts. Server-side only.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type { PostCardData } from "@/components/post/PostCard";

export type SortKey = "latest" | "popular" | "trending";

interface JoinedPost {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  community: { slug: string; name: string } | null;
}

const POST_SELECT = `
  id, community_id, author_id, title, body, image_url, created_at, updated_at,
  author:profiles!posts_author_id_fkey ( username, display_name, avatar_url ),
  community:communities!posts_community_id_fkey ( slug, name )
`;

interface VoteRow {
  post_id: string;
  value: number;
}
interface CommentRow {
  post_id: string;
}

/**
 * Fetch posts for a single community, with author + community joined, plus
 * vote score and comment count. Sort: latest | popular | trending.
 */
export async function getCommunityPosts(
  communityId: string,
  sort: SortKey = "latest",
  limit = 30
): Promise<PostCardData[]> {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!posts || posts.length === 0) return [];
  return await enrichPosts(posts as unknown as JoinedPost[], sort);
}

/**
 * Fetch posts from all communities the user has joined. Used on /home.
 */
export async function getHomeFeed(
  userId: string | null,
  sort: SortKey = "latest",
  limit = 30
): Promise<PostCardData[]> {
  const supabase = await createClient();

  let joinedIds: string[] = [];
  if (userId) {
    const { data: memberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId);
    joinedIds = (memberships ?? []).map(
      (m: { community_id: string }) => m.community_id
    );
  }

  let postsQuery = supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (joinedIds.length > 0) {
    postsQuery = postsQuery.in("community_id", joinedIds);
  }

  const { data: posts } = await postsQuery;
  if (!posts || posts.length === 0) return [];
  return await enrichPosts(posts as unknown as JoinedPost[], sort);
}

async function enrichPosts(
  posts: JoinedPost[],
  sort: SortKey
): Promise<PostCardData[]> {
  const supabase = await createClient();
  const postIds = posts.map((p: JoinedPost) => p.id);

  const [{ data: votes }, { data: comments }] = await Promise.all([
    supabase
      .from("post_votes")
      .select("post_id, value")
      .in("post_id", postIds),
    // Comments table may not exist yet (M5) — fall back to 0 if so.
    supabase.from("comments").select("post_id").in("post_id", postIds),
  ]);

  const scoreByPost = new Map<string, number>();
  for (const v of (votes ?? []) as VoteRow[]) {
    scoreByPost.set(
      v.post_id,
      (scoreByPost.get(v.post_id) ?? 0) + v.value
    );
  }
  const commentCountByPost = new Map<string, number>();
  for (const c of (comments ?? []) as CommentRow[]) {
    commentCountByPost.set(
      c.post_id,
      (commentCountByPost.get(c.post_id) ?? 0) + 1
    );
  }

  const now = Date.now();
  const enriched: (PostCardData & { trending?: number })[] = posts.map(
    (p: JoinedPost) => {
      const score = scoreByPost.get(p.id) ?? 0;
      const ageHours = Math.max(
        1,
        (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60)
      );
      return {
        id: p.id,
        community_id: p.community_id,
        author_id: p.author_id,
        title: p.title,
        body: p.body,
        image_url: p.image_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
        author: p.author,
        community: p.community,
        score,
        comment_count: commentCountByPost.get(p.id) ?? 0,
        trending: score / ageHours,
      };
    }
  );

  return sortPosts(enriched, sort);
}

function sortPosts(
  posts: (PostCardData & { trending?: number })[],
  sort: SortKey
): PostCardData[] {
  const copy = [...posts];
  if (sort === "popular") {
    copy.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  } else if (sort === "trending") {
    copy.sort((a, b) => (b.trending ?? 0) - (a.trending ?? 0));
  } else {
    copy.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  return copy;
}