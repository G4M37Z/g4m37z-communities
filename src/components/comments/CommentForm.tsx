"use client";

// src/components/comments/CommentForm.tsx
// Create or edit a comment. Used for top-level comments and replies.

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Send } from "lucide-react";
import { createComment, editComment } from "@/lib/comments/actions";

interface Props {
  postId: string;
  parentId?: string;
  initialBody?: string;
  mode: "create" | "edit";
  commentId?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({
  postId,
  parentId,
  initialBody = "",
  mode,
  commentId,
  onSubmitted,
  onCancel,
  autoFocus,
}: Props) {
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setError("Comment can't be empty.");
      return;
    }
    startTransition(async () => {
      const res =
        mode === "create" ? await createComment(formData) : await editComment(formData);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (mode === "create") setBody("");
      onSubmitted?.();
    });
  }

  return (
    <form action={onSubmit} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      {mode === "create" && parentId && (
        <input type="hidden" name="parentId" value={parentId} />
      )}
      {mode === "edit" && commentId && (
        <input type="hidden" name="commentId" value={commentId} />
      )}

      <textarea
        name="body"
        rows={3}
        required
        maxLength={10000}
        autoFocus={autoFocus}
        placeholder={mode === "create" ? "Add a comment…" : "Edit comment…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      {error && (
        <p className="flex items-center gap-1 text-xs text-sale">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:border-accent/60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
          {mode === "create" ? "Reply" : "Save"}
        </button>
      </div>
    </form>
  );
}