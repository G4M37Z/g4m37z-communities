// ============================================================================
// src/lib/creators/analytics.ts
// Creator analytics from REAL platform signals only. Read-only, bounded.
//
// Authorization: `getCreatorAnalytics(targetId, viewerId)` returns full
// metrics ONLY for self (targetId === viewerId) or a platform admin (resolved
// server-side from profiles.role). Everyone else gets null (404-like).
//
// Metrics (all countable from live tables; nothing faked):
//   posts_published        — lifetime posts by author
//   posts_last_30d         — posts in trailing 30 days
//   total_score            — sum of post vote values across all posts
//   total_comments         — comments on the author's posts
//   total_reposts          — reposts of the author's posts
//   followers              — rows in follows.followed_id
//   followers_prev_30d     — followers created before the 30d window (growth)
//   engagement_rate_30d    — (votes+comments+reposts on last-30d posts) / posts_last_30d
//   top_posts              — top 5 by score with per-post engagement
//
// Not measurable with current architecture (documented, NOT faked):
//   post views/impressions, profile views, per-follower attribution.
// ============================================================================

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TopPost {
  id: string;
  title: string;
  score: number;
  comments: number;
  reposts: number;
  created_at: string;
}

export interface CreatorAnalytics {
  posts_published: number;
  posts_last_30d: number;
  total_score: number;
  total_comments: number;
  total_reposts: number;
  followers: number;
  followers_30d_ago: number;
  follower_growth_30d: number;
  engagement_rate_30d: number | null; // null when no posts in window
  top_posts: TopPost[];
  window_days: 30;
}

export type AnalyticsResult =
  | { ok: true; analytics: CreatorAnalytics }
  | { ok: false; status: "unauthenticated" | "forbidden" | "not_found" | "error"; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOP_POSTS_LIMIT = 5;
const RECENT_WINDOW_DAYS = 30;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getCreatorAnalytics(
  targetId: string,
  viewerId: string | null
): Promise<AnalyticsResult> {
  if (!viewerId) {
    return { ok: false, status: "unauthenticated", error: "Sign in to view analytics." };
  }
  if (!UUID_RE.test(targetId)) {
    return { ok: false, status: "not_found", error: "Creator not found." };
  }

  const supabase = await createClient();

  // Authorization: self or platform admin only. Role is resolved server-side
  // from the database (never from the client), and never trusted across users.
  const isSelf = targetId === viewerId;
  if (!isSelf) {
    const { data: viewerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", viewerId)
      .maybeSingle();
    if (viewerProfile?.role !== "admin") {
      return { ok: false, status: "forbidden", error: "Analytics are private to the creator." };
    }
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (!targetProfile) {
    return { ok: false, status: "not_found", error: "Creator not found." };
  }

  const sinceIso = daysAgoIso(RECENT_WINDOW_DAYS);

  // --- Bounded parallel aggregations -------------------------------------
  const [postsRes, followersRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, created_at")
      .eq("author_id", targetId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("follows")
      .select("created_at", { count: "exact", head: true })
      .eq("followed_id", targetId),
  ]);

  if (postsRes.error) {
    return { ok: false, status: "error", error: postsRes.error.message };
  }

  const posts = (postsRes.data ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
  }>;
  const postIds = posts.map((p) => p.id);

  const postsLast30d = posts.filter((p) => p.created_at >= sinceIso).length;

  // Engagement on the author's posts: votes, comments, reposts (batched, in).
  const [votesRes, commentsRes, repostsRes] = await Promise.all([
    postIds.length
      ? supabase.from("post_votes").select("post_id, value").in("post_id", postIds)
      : Promise.resolve({ data: null, error: null }),
    postIds.length
      ? supabase.from("comments").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: null, error: null }),
    postIds.length
      ? supabase.from("reposts").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const votesByPost = new Map<string, number>();
  for (const v of (votesRes.data ?? []) as Array<{ post_id: string; value: number }>) {
    votesByPost.set(v.post_id, (votesByPost.get(v.post_id) ?? 0) + v.value);
  }
  const commentsByPost = new Map<string, number>();
  for (const c of (commentsRes.data ?? []) as Array<{ post_id: string }>) {
    commentsByPost.set(c.post_id, (commentsByPost.get(c.post_id) ?? 0) + 1);
  }
  const repostsByPost = new Map<string, number>();
  for (const r of (repostsRes.data ?? []) as Array<{ post_id: string }>) {
    repostsByPost.set(r.post_id, (repostsByPost.get(r.post_id) ?? 0) + 1);
  }

  let totalScore = 0;
  let totalComments = 0;
  let totalReposts = 0;
  let recentEngagement = 0;
  const topPosts: TopPost[] = [];
  for (const p of posts) {
    const score = votesByPost.get(p.id) ?? 0;
    const comments = commentsByPost.get(p.id) ?? 0;
    const reposts = repostsByPost.get(p.id) ?? 0;
    totalScore += score;
    totalComments += comments;
    totalReposts += reposts;
    if (p.created_at >= sinceIso) recentEngagement += score + comments + reposts;
    topPosts.push({ id: p.id, title: p.title, score, comments, reposts, created_at: p.created_at });
  }
  topPosts.sort(
    (a, b) => b.score + b.comments + b.reposts - (a.score + a.comments + a.reposts)
  );

  // Follower snapshot 30 days ago (bounded by indexed followed_id scan).
  let followers30dAgo = 0;
  if ((followersRes.count ?? 0) > 0) {
    const { count } = await supabase
      .from("follows")
      .select("created_at", { count: "exact", head: true })
      .eq("followed_id", targetId)
      .lt("created_at", sinceIso);
    followers30dAgo = count ?? 0;
  }

  const analytics: CreatorAnalytics = {
    posts_published: posts.length,
    posts_last_30d: postsLast30d,
    total_score: totalScore,
    total_comments: totalComments,
    total_reposts: totalReposts,
    followers: followersRes.count ?? 0,
    followers_30d_ago: followers30dAgo,
    follower_growth_30d: (followersRes.count ?? 0) - followers30dAgo,
    engagement_rate_30d:
      postsLast30d > 0 ? recentEngagement / postsLast30d : null,
    top_posts: topPosts.slice(0, TOP_POSTS_LIMIT),
    window_days: RECENT_WINDOW_DAYS,
  };

  return { ok: true, analytics };
}
