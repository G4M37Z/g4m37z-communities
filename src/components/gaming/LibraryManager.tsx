"use client";

// ============================================================================
// src/components/gaming/LibraryManager.tsx
// Owner-only library editor on the gaming profile: search the game
// catalogue, attach statuses (owned/playing/want_to_play/favorite/followed),
// remove rows. Optimistic with revert on failure; authorization is enforced
// server-side (actions + 052 RLS) — this UI only calls the owner actions.
// ============================================================================

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, X, Search } from "lucide-react";
import { GameCover } from "@/components/games/GameCover";
import {
  addGameStatusAction,
  removeGameStatusAction,
  searchGamesAction,
  type GamePick,
} from "@/lib/gaming/actions";
import {
  GAME_STATUSES,
  GAME_STATUS_LABELS,
  type GameStatus,
  type UserGame,
} from "@/lib/gaming/types";

interface Props {
  /** catalogue games the user already tracks (to disable re-adding) */
  existing: UserGame[];
}

export function LibraryManager({ existing }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GamePick[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const covered = useMemo(() => {
    const m = new Map<string, Set<GameStatus>>();
    for (const row of existing) {
      const set = m.get(row.game_id) ?? new Set<GameStatus>();
      set.add(row.status);
      m.set(row.game_id, set);
    }
    return m;
  }, [existing]);

  function runSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    startTransition(async () => {
      try {
        const picks = await searchGamesAction(term);
        setResults(picks);
      } finally {
        setSearching(false);
      }
    });
  }

  function add(game: GamePick, status: GameStatus) {
    setError(null);
    startTransition(async () => {
      const res = await addGameStatusAction({ game_id: game.id, status });
      if (!res.ok) setError(res.error);
    });
  }

  function remove(gameId: string, status: GameStatus) {
    setError(null);
    startTransition(async () => {
      const res = await removeGameStatusAction({ game_id: gameId, status });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch(query);
              }
            }}
            placeholder="Search games to add to your library"
            aria-label="Search games"
            className="h-10 w-full rounded-md border border-border bg-bg pl-9 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="button"
          onClick={() => runSearch(query)}
          disabled={pending || searching}
          className="press inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-accent disabled:opacity-60"
        >
          {searching || pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Find"
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-sale">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((g) => {
            const statuses = covered.get(g.id) ?? new Set<GameStatus>();
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2"
              >
                <div className="w-10 shrink-0">
                  <GameCover title={g.name} url={g.cover_url} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{g.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {GAME_STATUSES.map((s) =>
                      statuses.has(s) ? (
                        <button
                          key={s}
                          type="button"
                          onClick={() => remove(g.id, s)}
                          title={`Remove ${GAME_STATUS_LABELS[s]}`}
                          className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent-text"
                        >
                          {GAME_STATUS_LABELS[s]}
                          <X size={10} />
                        </button>
                      ) : (
                        <button
                          key={s}
                          type="button"
                          onClick={() => add(g, s)}
                          title={`Mark as ${GAME_STATUS_LABELS[s]}`}
                          className="inline-flex items-center gap-0.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:border-accent hover:text-fg"
                        >
                          <Plus size={10} />
                          {GAME_STATUS_LABELS[s]}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
