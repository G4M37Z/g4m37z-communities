"use client";
// TournamentOrgControls — organiser-only status transitions and delete.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateTournamentAction,
  deleteTournamentAction,
} from "@/lib/tournaments/actions";

export function TournamentOrgControls({
  tournamentId,
  currentStatus,
}: {
  tournamentId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(next: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateTournamentAction(tournamentId, {
        status: next as
          | "REGISTRATION"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED",
      });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Action failed");
    });
  }

  function del() {
    setError(null);
    if (!confirm("Delete this tournament? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteTournamentAction(tournamentId);
      if (res.ok) router.push("/tournaments");
      else setError(res.error ?? "Action failed");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {currentStatus === "REGISTRATION" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("IN_PROGRESS")}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Start tournament
        </button>
      )}
      {(currentStatus === "REGISTRATION" ||
        currentStatus === "IN_PROGRESS") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("COMPLETED")}
          className="press inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg hover:border-border-strong disabled:opacity-60"
        >
          Mark completed
        </button>
      )}
      {currentStatus !== "CANCELLED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("CANCELLED")}
          className="press inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg hover:border-border-strong disabled:opacity-60"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={del}
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
