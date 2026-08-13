// ============================================================================
// src/lib/comments/queries.ts
// Read-only helpers for comments + votes. Server-side only.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export interface JoinedComment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ThreadedComment extends JoinedComment {
  replies: ThreadedComment[];
  score: number;
  my_vote: 1 | -1 | null;
}

/**
 * Fetch all comments for a post (flat list), then assemble them into a
 * nested tree by parent_id. One round-trip for comments, one for votes.
 */
export async function getCommentThread(
  postId: string,
  viewerId: string | null
): Promise<ThreadedComment[]> {
  const supabase = await createClient();

  const [{ data: comments }, { data: votes }] = await Promise.all([
    supabase
      .from("comments")
      .select(
        `id, post_id, author_id, parent_id, body, created_at, updated_at,
         author:profiles!comments_author_id_fkey ( username, display_name, avatar_url )`
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    supabase
      .from("comment_votes")
      .select("comment_id, user_id, value")
      .in(
        "comment_id",
        // We don't have the comment ids yet, so this returns empty for the
        // first call. Fall back to a second query if needed — see below.
        []
      ),
  ]);

  // Vote lookup: get votes for these specific comment ids. The IN(...) trick
  // above won't work pre-insert; do it after we know the comment ids.
  const flat = (comments ?? []) as unknown as JoinedComment[];
  const ids = flat.map((c) => c.id);
  let voteRows: { comment_id: string; user_id: string; value: number }[] = [];
  if (ids.length > 0) {
    const { data: voteData } = await supabase
      .from("comment_votes")
      .select("comment_id, user_id, value")
      .in("comment_id", ids);
    voteRows = (voteData ?? []) as {
      comment_id: string;
      user_id: string;
      value: number;
    }[];
  }
  // Use the second query as the source of truth; ignore the first empty one.
  void votes;

  const scoreByComment = new Map<string, number>();
  for (const v of voteRows) {
    scoreByComment.set(
      v.comment_id,
      (scoreByComment.get(v.comment_id) ?? 0) + v.value
    );
  }

  const myVoteByComment = new Map<string, 1 | -1>();
  if (viewerId) {
    for (const v of voteRows) {
      if (v.user_id === viewerId) {
        myVoteByComment.set(v.comment_id, v.value === 1 ? 1 : -1);
      }
    }
  }

  // Build the tree.
  const byId = new Map<string, ThreadedComment>();
  for (const c of flat) {
    byId.set(c.id, {
      ...c,
      replies: [],
      score: scoreByComment.get(c.id) ?? 0,
      my_vote: myVoteByComment.get(c.id) ?? null,
    });
  }
  const roots: ThreadedComment[] = [];
  for (const c of flat) {
    const node = byId.get(c.id);
    if (!node) continue;
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}