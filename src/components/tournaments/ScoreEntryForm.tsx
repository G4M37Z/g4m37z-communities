"use client";
// ScoreEntryForm — Manual score input for a specific tournament stage.
// Persists via the updateTournamentScoreAction server action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  updateTournamentScoreAction,
} from "@/lib/tournaments/actions";
import type { UpdateScoreInput } from "@/lib/tournaments/service";

interface Props {
  tournamentId: string;
  stageId: string;
  stageLabel: string;
  initialScores: { userId: string; name: string; score: number }[];
}

export function ScoreEntryForm({ tournamentId, stageId, stageLabel, initialScores }: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(initialScores.map((s) => [s.userId, s.score === 0 ? "" : String(s.score)]))
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateScore(userId: string, value: string) {
    setScores((prev) => ({ ...prev, [userId]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const updates: UpdateScoreInput[] = Object.entries(scores)
          .map(([userId, score]) => {
            if (score === "") return null;
            const parsed = parseFloat(score);
            if (!Number.isFinite(parsed)) return null;
            return { tournamentId, stageId, userId, score: parsed };
          })
          .filter((u): u is UpdateScoreInput => u !== null);

        for (const up of updates) {
          const res = await updateTournamentScoreAction(up);
          if (!res.ok) throw new Error(res.error ?? "Failed to update score");
        }
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-base font-bold text-fg">Stage scores</h3>
        {saved && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Enter the final points for each player in {stageLabel}. Blank rows are
        left unchanged.
      </p>

      {initialScores.length === 0 ? (
        <p className="mb-4 text-xs text-text-secondary">
          No participants on this stage yet. The list fills as the organiser
          enters scores for the players who compete.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {initialScores.map((p) => (
            <div key={p.userId} className="flex items-center gap-3">
              <span className="w-40 truncate text-xs text-text-secondary">
                {p.name || `User ${p.userId.slice(0, 8)}`}
              </span>
              <input
                type="number"
                step="any"
                value={scores[p.userId]}
                onChange={(e) => updateScore(p.userId, e.target.value)}
                aria-label={`${p.name || "participant"} score`}
                className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-none"
                placeholder="0.0"
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save scores"}
        </button>
        {error && <p role="alert" className="text-xs text-sale">{error}</p>}
      </div>
    </form>
  );
}