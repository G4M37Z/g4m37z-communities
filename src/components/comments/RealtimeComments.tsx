"use client";

// src/components/comments/RealtimeComments.tsx
// Subscribes to new comments for the current post via Supabase realtime.
// New top-level comments are prepended; replies are attached under their
// parent. Dedupes against optimistic inserts from CommentForm.

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Comment } from "@/components/comments/Comment";

interface Author {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CommentNode {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  author: Author | null;
  score: number;
  my_vote: 1 | -1 | null;
}

interface ThreadedComment extends CommentNode {
  replies: ThreadedComment[];
}

function findAndReplace(
  tree: ThreadedComment[],
  id: string,
  fn: (existing: ThreadedComment | null) => ThreadedComment | null,
): ThreadedComment[] {
  let changed = false;
  const next = tree.map((node) => {
    if (node.id === id) {
      changed = true;
      const result = fn(node);
      return result ?? node;
    }
    if (node.replies.length > 0) {
      const newReplies = findAndReplace(node.replies, id, fn);
      if (newReplies !== node.replies) {
        changed = true;
        return { ...node, replies: newReplies };
      }
    }
    return node;
  });
  return changed ? next : tree;
}

interface Props {
  postId: string;
  initialComments: ThreadedComment[];
  currentUserId: string | null;
}

export function RealtimeComments({
  postId,
  initialComments,
  currentUserId,
}: Props) {
  // Re-sync local state from props via a derived key on the parent: the
  // page passes `key={postId}` so navigation mounts a fresh instance and
  // we never need to sync from a server-rendered prop mid-life.
  const [comments, setComments] = useState<ThreadedComment[]>(initialComments);

  const insertNode = useCallback(
    async (inserted: {
      id: string;
      post_id: string;
      author_id: string;
      parent_id: string | null;
      body: string;
      created_at: string;
      updated_at: string;
    }) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return;
      const supabase = createBrowserClient(url, anon);

      const { data: author } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", inserted.author_id)
        .maybeSingle();

      const node: ThreadedComment = {
        ...inserted,
        author: (author as Author | null) ?? null,
        score: 0,
        my_vote: null,
        replies: [],
      };

      setComments((prev) => {
        // Dedupe — already present (optimistic insert from CommentForm).
        const exists = (tree: ThreadedComment[]): boolean => {
          for (const c of tree) {
            if (c.id === node.id) return true;
            if (c.replies.length > 0 && exists(c.replies)) return true;
          }
          return false;
        };
        if (exists(prev)) return prev;

        if (!node.parent_id) {
          return [node, ...prev];
        }
        // Attach as reply under the parent.
        return findAndReplace(prev, node.parent_id, (existing) => {
          if (!existing) return null;
          return {
            ...existing,
            replies: [...existing.replies, node],
          };
        });
      });
    },
    [],
  );

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    const supabase = createBrowserClient(url, anon);

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          void insertNode(payload.new as Parameters<typeof insertNode>[0]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, insertNode]);

  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-10 text-center">
        <p className="text-sm text-text-secondary">
          No comments yet. Be the first to share what you think.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id}>
          <Comment
            comment={c}
            postId={postId}
            currentUserId={currentUserId}
          />
        </li>
      ))}
    </ul>
  );
}