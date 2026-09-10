"use client";
// EventHostControls — editor-only publish / cancel / delete actions.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishEventAction,
  cancelEventAction,
  deleteEventAction,
} from "@/lib/events/actions";

export function EventHostControls({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action(eventId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Action failed");
      }
    });
  }

  const isDraft = status === "DRAFT";
  const isPublished = status === "PUBLISHED" || status === "FULL";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(publishEventAction)}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Publish
        </button>
      )}
      {isPublished && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(cancelEventAction)}
          className="press inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg hover:border-border-strong disabled:opacity-60"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(deleteEventAction)}
        className="press inline-flex h-9 items-center rounded-md border border-sale bg-bg px-3 text-xs font-semibold text-sale hover:bg-sale hover:text-white disabled:opacity-60"
      >
        Delete
      </button>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
