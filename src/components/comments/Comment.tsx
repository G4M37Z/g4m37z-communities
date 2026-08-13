"use client";

// src/components/comments/Comment.tsx
// Single comment + its replies (recursive). Edit/delete for the author.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Reply, AlertCircle, Loader2, X, Check } from "lucide-react";
import type { ThreadedComment } from "@/lib/comments/queries";
import { CommentVoteControl } from "@/components/voting/CommentVoteControl";
import { CommentForm } from "./CommentForm";
import { deleteComment } from "@/lib/comments/actions";
import { timeAgo } from "@/lib/utils";

interface Props {
  comment: ThreadedComment;
  postId: string;
  currentUserId: string | null;
  depth?: number;
}

const MAX_DEPTH = 4;

export function Comment({
  comment,
  postId,
  currentUserId,
  depth = 0,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isAuthor = Boolean(
    currentUserId && currentUserId === comment.author_id
  );

  function onDelete() {
    setError(null);
    const fd = new FormData();
    fd.set("commentId", comment.id);
    fd.set("postId", postId);
    startTransition(async () => {
      const res = await deleteComment(fd);
      if (res.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={
        depth === 0
          ? "rounded-2xl border border-border bg-surface p-4"
          : "rounded-xl border border-border bg-surface/60 p-3"
      }
    >
      <header className="mb-2 flex items-center gap-2 text-xs text-text-muted">
        {comment.author ? (
          <>
            <Link
              href={`/profile/${comment.author.username}`}
              className="font-semibold text-fg hover:text-accent"
            >
              @{comment.author.username}
            </Link>
            <span aria-hidden="true">·</span>
          </>
        ) : (
          <span>unknown</span>
        )}
        <time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>
        {comment.updated_at !== comment.created_at && (
          <>
            <span aria-hidden="true">·</span>
            <span>edited</span>
          </>
        )}
      </header>

      {editing ? (
        <CommentForm
          postId={postId}
          mode="edit"
          commentId={comment.id}
          initialBody={comment.body}
          autoFocus
          onSubmitted={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-fg">{comment.body}</p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <CommentVoteControl
          commentId={comment.id}
          postId={postId}
          initialScore={comment.score}
          initialVote={comment.my_vote}
        />
        {currentUserId && !editing && depth < MAX_DEPTH && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-bg hover:text-fg"
          >
            <Reply size={12} />
            Reply
          </button>
        )}
        {isAuthor && !editing && !confirming && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-bg hover:text-fg"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-bg hover:text-sale"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </>
        )}
        {confirming && (
          <span className="flex items-center gap-2">
            <span className="text-sale">Delete?</span>
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-sale px-2 text-[11px] font-semibold text-white hover:bg-sale/90 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Check size={10} />
              )}
              Yes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-bg px-2 text-[11px] font-medium text-fg hover:border-accent/60"
            >
              <X size={10} />
              No
            </button>
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-sale">
            <AlertCircle size={12} /> {error}
          </span>
        )}
      </footer>

      {replying && currentUserId && (
        <div className="mt-3 border-t border-border pt-3">
          <CommentForm
            postId={postId}
            parentId={comment.id}
            mode="create"
            autoFocus
            onSubmitted={() => setReplying(false)}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}

      {comment.replies.length > 0 && (
        <ul
          className={`mt-3 space-y-2 ${
            depth < MAX_DEPTH ? "border-l border-border pl-3" : ""
          }`}
        >
          {comment.replies.map((r) => (
            <li key={r.id}>
              <Comment
                comment={r}
                postId={postId}
                currentUserId={currentUserId}
                depth={depth + 1}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}