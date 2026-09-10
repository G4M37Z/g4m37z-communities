"use client";
// LfgJoinLeaveButton — toggles lfg_participants row for the current user.
// Optimistic UI on both states; reverts on server error.
import { useState, useTransition } from "react";
import { joinLfgAction, leaveLfgAction } from "@/lib/lfg/actions";

export function LfgJoinLeaveButton({
  sessionId,
  initiallyParticipant,
  disabled,
  disabledReason,
}: {
  sessionId: string;
  initiallyParticipant: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const [joined, setJoined] = useState(initiallyParticipant);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-muted opacity-60"
        >
          {disabledReason ?? "Unavailable"}
        </button>
      </div>
    );
  }

  function toggle() {
    setError(null);
    const next = !joined;
    setJoined(next);
    startTransition(async () => {
      const action = next ? joinLfgAction : leaveLfgAction;
      const res = await action(sessionId);
      if (!res.ok) {
        setJoined(!next);
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
        aria-pressed={joined}
        className={
          "press inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold disabled:opacity-60 " +
          (joined
            ? "border border-border bg-surface text-fg hover:border-border-strong"
            : "bg-accent text-white hover:bg-accent-hover")
        }
      >
        {pending ? "…" : joined ? "Leave session" : "Join session"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
