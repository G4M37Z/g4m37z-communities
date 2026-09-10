"use client";
// EventRsvpButton — toggles event_participants row for the current user.
// Optimistic UI on both states; reverts on server error.
import { useState, useTransition } from "react";
import { rsvpEventAction, cancelRsvpEventAction } from "@/lib/events/actions";

export function EventRsvpButton({
  eventId,
  initiallyRsvpd,
  disabled,
  disabledReason,
}: {
  eventId: string;
  initiallyRsvpd: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const [rsvpd, setRsvpd] = useState(initiallyRsvpd);
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
    const next = !rsvpd;
    setRsvpd(next);
    startTransition(async () => {
      const action = next ? rsvpEventAction : cancelRsvpEventAction;
      const res = await action(eventId);
      if (!res.ok) {
        setRsvpd(!next);
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
        aria-pressed={rsvpd}
        className={
          "press inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold disabled:opacity-60 " +
          (rsvpd
            ? "border border-border bg-surface text-fg hover:border-border-strong"
            : "bg-accent text-white hover:bg-accent-hover")
        }
      >
        {pending ? "…" : rsvpd ? "Cancel RSVP" : "RSVP"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
