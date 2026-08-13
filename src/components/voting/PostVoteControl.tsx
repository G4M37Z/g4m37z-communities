"use client";

// src/components/voting/VoteControl.tsx
// Vertical upvote / score / downvote stack. Renders compact in feed cards
// and inline in the post detail / comment threads.

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { setPostVote } from "@/lib/comments/actions";

interface Props {
  postId: string;
  initialScore: number;
  initialVote: 1 | -1 | null;
  // Render orientation. "vertical" for posts; comments use "vertical" too
  // but slightly tighter; "compact" for card displays.
  variant?: "vertical" | "compact";
}

export function PostVoteControl({
  postId,
  initialScore,
  initialVote,
  variant = "vertical",
}: Props) {
  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<1 | -1 | null>(initialVote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onVote(value: 1 | -1) {
    setError(null);
    const wasVote = vote;
    const wasScore = score;
    // Optimistic update.
    if (vote === value) {
      setVote(null);
      setScore(score - value);
    } else if (vote === null) {
      setVote(value);
      setScore(score + value);
    } else {
      setVote(value);
      setScore(score + value * 2); // switching sides
    }

    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("value", String(value));
    startTransition(async () => {
      const res = await setPostVote(fd);
      if (res.error) {
        setError(res.error);
        // Roll back.
        setVote(wasVote);
        setScore(wasScore);
      }
    });
  }

  const size = variant === "compact" ? 14 : 16;
  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-fg disabled:opacity-50";

  return (
    <div
      className={
        variant === "compact"
          ? "flex items-center gap-1"
          : "flex flex-col items-center gap-0.5"
      }
      aria-label={`Score ${score}`}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => onVote(1)}
        aria-label="Upvote"
        aria-pressed={vote === 1}
        className={`${btn} ${vote === 1 ? "text-accent" : ""}`}
      >
        <ChevronUp size={size} />
      </button>
      <span
        className={`min-w-[1.5rem] text-center text-xs font-bold ${
          vote === 1
            ? "text-accent"
            : vote === -1
              ? "text-sale"
              : "text-fg"
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
        className={`${btn} ${vote === -1 ? "text-sale" : ""}`}
      >
        <ChevronDown size={size} />
      </button>
      {error && (
        <p
          role="alert"
          className="mt-1 max-w-[8rem] text-center text-[10px] text-sale"
        >
          {error}
        </p>
      )}
    </div>
  );
}