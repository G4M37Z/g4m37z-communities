"use client";
// TournamentAdvanceButton — organiser-only manual trigger to advance a
// framework tournament to its next stage (SPEC open question: manual trigger
// for safety). Calls advanceTournamentStageAction; the service computes the
// advancing players, moves the stage pointer, or completes the tournament.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceTournamentStageAction } from "@/lib/tournaments/actions";

export function TournamentAdvanceButton({
  tournamentId,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function advance() {
    setError(null);
    startTransition(async () => {
      const res = await advanceTournamentStageAction(tournamentId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Could not advance stage");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={advance}
        className="press inline-flex h-9 items-center rounded-md border border-accent bg-accent/10 px-3 text-xs font-semibold text-accent-text hover:bg-accent hover:text-white disabled:opacity-40"
      >
        {pending ? "Advancing…" : "Advance stage"}
      </button>
      {(disabled || error) && (
        <span className="text-[10px] text-text-muted" role="alert">
          {error ?? disabledReason}
        </span>
      )}
    </span>
  );
}