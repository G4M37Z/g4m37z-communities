"use client";
// TournamentRegisterButton — captain registers a new team for this user.
// One team per captain per tournament is the natural model (captain_id
// + tournament_id has no explicit unique index, but the captain can only
// realistically run one team at a time per the schema).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerTeamAction } from "@/lib/tournaments/actions";

export function TournamentRegisterButton({
  tournamentId,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-muted opacity-60"
      >
        {disabledReason ?? "Unavailable"}
      </button>
    );
  }

  function submit() {
    setError(null);
    const name = teamName.trim();
    if (name.length === 0) {
      setError("Enter a team name");
      return;
    }
    startTransition(async () => {
      const res = await registerTeamAction({
        tournamentId,
        name,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Failed to register");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={64}
          placeholder="Team name"
          aria-label="Team name"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "…" : "Register team"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
