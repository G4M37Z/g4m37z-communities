"use client";

// src/components/profile/FollowButton.tsx
// Optimistic follow/unfollow. Uses the existing social server actions
// (RLS-scoped; identity resolved server-side). Self-follow is never
// rendered — the server page hides this component for the owner.

import { useState, useTransition } from "react";
import { Loader2, UserPlus, UserMinus } from "lucide-react";
import { followUserAction, unfollowUserAction } from "@/lib/social/actions";

interface Props {
  targetUserId: string;
  initialFollowing: boolean;
}

export function FollowButton({ targetUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !following;
    setFollowing(next); // optimistic
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", targetUserId);
      try {
        if (next) await followUserAction(fd);
        else await unfollowUserAction(fd);
      } catch {
        setFollowing(!next); // revert on failure
        setError("Couldn't update. Try again.");
      }
    });
  }

  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          following
            ? "border border-border bg-surface text-fg hover:border-border-strong"
            : "bg-accent text-white hover:bg-accent-hover"
        }`}
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : following ? (
          <UserMinus size={14} />
        ) : (
          <UserPlus size={14} />
        )}
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <span role="alert" className="absolute top-full mt-1 whitespace-nowrap text-xs text-sale">
          {error}
        </span>
      )}
    </span>
  );
}
