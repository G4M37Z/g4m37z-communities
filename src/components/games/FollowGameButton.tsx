"use client";
// FollowGameButton — toggles game_followers row for the current user.
// Calls server actions (followGame / unfollowGame) implemented in
// src/lib/games/actions.ts. Optimistic UI: state flips immediately,
// reverts on server error.
import { useState, useTransition } from "react";
import { followGameAction, unfollowGameAction } from "@/lib/games/actions";

export function FollowGameButton({
  gameId,
  initiallyFollowing,
}: {
  gameId: string;
  initiallyFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      const action = next ? followGameAction : unfollowGameAction;
      const res = await action(gameId);
      if (!res.ok) {
        setFollowing(!next); // revert
        setError(res.error ?? "Action failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={
          "press inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold disabled:opacity-60 " +
          (following
            ? "border border-border bg-surface text-fg hover:border-border-strong"
            : "bg-accent text-white hover:bg-accent-hover")
        }
      >
        {pending ? "..." : following ? "Following" : "Follow"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
