"use client";

// src/components/voting/CommentVoteControl.tsx
// Horizontal inline vote control for comments (next to the comment body).

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { setCommentVote } from "@/lib/comments/actions";

interface Props {
  commentId: string;
  postId: string;
  initialScore: number;
  initialVote: 1 | -1 | null;
}

export function CommentVoteControl({
  commentId,
  postId,
  initialScore,
  initialVote,
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<1 | -1 | null>(initialVote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onVote(value: 1 | -1) {
    setError(null);
    const wasVote = vote;
    const wasScore = score;
    if (vote === value) {
      setVote(null);
      setScore(score - value);
    } else if (vote === null) {
      setVote(value);
      setScore(score + value);
    } else {
      setVote(value);
      setScore(score + value * 2);
    }

    const fd = new FormData();
    fd.set("commentId", commentId);
    fd.set("postId", postId);
    fd.set("value", String(value));
    startTransition(async () => {
      const res = await setCommentVote(fd);
      if (res.error) {
        setError(res.error);
        setVote(wasVote);
        setScore(wasScore);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1 text-xs text-text-muted">
      <button
        type="button"
        disabled={pending}
        onClick={() => onVote(1)}
        aria-label="Upvote"
        aria-pressed={vote === 1}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-bg hover:text-fg disabled:opacity-50 ${vote === 1 ? "text-accent" : ""}`}
      >
        <ChevronUp size={12} />
      </button>
      <span
        className={`min-w-[1.25rem] text-center font-semibold ${
          vote === 1 ? "text-accent" : vote === -1 ? "text-sale" : "text-fg"
        }`}
      >
        {pending ? <Loader2 size={10} className="mx-auto animate-spin" /> : score}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => onVote(-1)}
        aria-label="Downvote"
        aria-pressed={vote === -1}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-bg hover:text-fg disabled:opacity-50 ${vote === -1 ? "text-sale" : ""}`}
      >
        <ChevronDown size={12} />
      </button>
      {error && (
        <p role="alert" className="ml-1 text-[10px] text-sale">
          {error}
        </p>
      )}
    </div>
  );
}