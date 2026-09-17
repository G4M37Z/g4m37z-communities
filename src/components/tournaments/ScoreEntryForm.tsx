"use client";
// ScoreEntryForm — Manual score input for a specific tournament stage.
// Persists via updateTournamentScore action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { updateTournamentScore, type UpdateScoreInput } from "@/lib/tournaments/service";

interface Props {
  tournamentId: string;
  stageId: string;
  initialScores: { userId: string; score: number }[];
}

export function ScoreEntryForm({ tournamentId, stageId, initialScores }: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(initialScores.map((s) => [s.userId, String(s.score)]))
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
        const updates: UpdateScoreInput[] = Object.entries(scores).map(([userId, score]) => {
          if (score === "") return null;
          return {
            tournamentId,
            stageId,
            userId,
            score: parseFloat(score),
          };
        }).filter((u): u is UpdateScoreInput => u !== null);

        for (const up of updates) {
          const res = await updateTournamentScore(up);
          if (!res.ok) throw new Error(res.error || "Failed to update score");
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
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-base font-bold text-fg">Enter Stage Scores</h3>
        {saved && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-text-muted">
        Enter the final points for each player in this stage.
      </p>

      <div className="flex flex-col gap-2">
        {Object.entries(scores).map(([userId, value]) => (
          <div key={userId} className="flex items-center gap-3">
            <span className="w-32 truncate text-xs text-text-secondary">
              User {userId.slice(0, 8)}...
            </span>
            <input
              type="number"
              value={value}
              onChange={(e) => updateScore(userId, e.target.value)}
              className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-none"
              placeholder="0.0"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save Scores"}
        </button>
        {error && <p role="alert" className="text-xs text-sale">{error}</p>}
      </div>
    </form>
  );
}
