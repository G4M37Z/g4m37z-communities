"use client";

// src/components/post/RepostButton.tsx
// Optimistic repost/un-repost toggle. Label shows "Reposted" when active.

import { useState, useTransition } from "react";
import { Repeat2 } from "lucide-react";
import { repostAction, unrepostAction } from "@/lib/reposts/actions";

interface Props {
  postId: string;
  initialReposted: boolean;
  initialCount: number;
  signedIn: boolean;
}

export function RepostButton({ postId, initialReposted, initialCount, signedIn }: Props) {
  const [reposted, setReposted] = useState(initialReposted);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!signedIn || pending) return;
    const next = !reposted;
    // Optimistic flip.
    setReposted(next);
    setCount((c) => c + (next ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const res = next ? await repostAction(postId) : await unrepostAction(postId);
      if (!res.ok) {
        // Revert on failure.
        setReposted(!next);
        setCount((c) => c + (next ? -1 : 1));
        setError(res.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }

  if (!signedIn) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-muted" aria-label={`${count} reposts`}>
        <Repeat2 size={12} />
        {count}
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={reposted}
        aria-label={reposted ? "Undo repost" : "Repost to your feed"}
        className={`inline-flex items-center gap-1 text-xs transition-colors hover:text-fg ${
          reposted ? "font-semibold text-accent" : "text-text-muted"
        } ${pending ? "opacity-60" : ""}`}
      >
        <Repeat2 size={12} />
        {count > 0 ? count : "Repost"}
      </button>
      {error && (
        <span role="alert" className="absolute left-0 top-full mt-1 whitespace-nowrap text-[10px] text-sale">
          {error}
        </span>
      )}
    </span>
  );
}
