"use client";

// ============================================================================
// src/components/gaming/IdentityManager.tsx
// Owner-only per-game identity editor: in-game name, rank label, region,
// optional catalogue platform slug. One identity per game (052 unique).
// Server actions enforce authorization; this is the owner's form.
// ============================================================================

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { GameCover } from "@/components/games/GameCover";
import {
  saveGameIdentityAction,
  deleteGameIdentityAction,
  searchGamesAction,
  type GamePick,
} from "@/lib/gaming/actions";
import type { GamePlatformIdentity } from "@/lib/gaming/types";

interface Props {
  existing: GamePlatformIdentity[];
}

const EMPTY = {
  game_id: "",
  game_name: "",
  platform_slug: "",
  in_game_name: "",
  rank_label: "",
  region: "",
};

export function IdentityManager({ existing }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [results, setResults] = useState<GamePick[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function pickGame(g: GamePick) {
    setForm({ ...form, game_id: g.id, game_name: g.name });
    setResults([]);
  }

  async function search(q: string) {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchGamesAction(term));
    } finally {
      setSearching(false);
    }
  }

  function submit() {
    setError(null);
    setSaved(false);
    if (!form.game_id || !form.in_game_name.trim()) {
      setError("Pick a game and enter the in-game name.");
      return;
    }
    startTransition(async () => {
      const res = await saveGameIdentityAction({
        game_id: form.game_id,
        platform_slug: form.platform_slug || null,
        in_game_name: form.in_game_name,
        rank_label: form.rank_label || null,
        region: form.region || null,
      });
      if (res.ok) {
        setForm({ ...EMPTY });
        setSaved(true);
      } else {
        setError(res.error);
      }
    });
  }

  function remove(gameId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteGameIdentityAction({ game_id: gameId });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div>
      <div className="rounded-lg border border-border bg-bg p-3">
        {form.game_id ? (
          <p className="mb-3 text-sm font-semibold text-fg">
            Editing identity for <span className="text-accent-text">{form.game_name}</span>
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              onChange={(e) => void search(e.target.value)}
              placeholder="Search a game to add your identity"
              aria-label="Search a game for your identity"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {searching && <Loader2 size={16} className="mt-3 animate-spin" />}
          </div>
        )}
        {results.length > 0 && (
          <ul className="mt-2 space-y-1">
            {results.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => pickGame(g)}
                  className="flex w-full items-center gap-2 rounded-md p-1 text-left text-sm text-fg hover:bg-white/5"
                >
                  <span className="w-8 shrink-0">
                    <GameCover title={g.name} url={g.cover_url} />
                  </span>
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {form.game_id && (
          <div className="space-y-3">
            <div>
              <label htmlFor="ign" className="mb-1 block text-xs font-medium text-text-secondary">
                In-game name
              </label>
              <input
                id="ign"
                value={form.in_game_name}
                onChange={(e) => setForm({ ...form, in_game_name: e.target.value })}
                maxLength={64}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rank" className="mb-1 block text-xs font-medium text-text-secondary">
                  Rank / level (optional)
                </label>
                <input
                  id="rank"
                  value={form.rank_label}
                  onChange={(e) => setForm({ ...form, rank_label: e.target.value })}
                  maxLength={64}
                  placeholder="e.g. Diamond IV"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label htmlFor="region" className="mb-1 block text-xs font-medium text-text-secondary">
                  Region (optional)
                </label>
                <input
                  id="region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  maxLength={16}
                  placeholder="e.g. EU West"
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            </div>
            <div>
              <label htmlFor="pslug" className="mb-1 block text-xs font-medium text-text-secondary">
                Platform (optional)
              </label>
              <input
                id="pslug"
                value={form.platform_slug}
                onChange={(e) => setForm({ ...form, platform_slug: e.target.value })}
                maxLength={32}
                placeholder="steam, playstation, xbox…"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="press inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                <Plus size={14} />
                Save identity
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...EMPTY })}
                className="h-9 rounded-md px-3 text-sm text-text-muted hover:text-fg"
              >
                Cancel
              </button>
            </div>
            {error && (
              <p role="alert" className="text-xs text-sale">
                {error}
              </p>
            )}
            {saved && <p className="text-xs text-success">Identity saved.</p>}
          </div>
        )}
      </div>

      {existing.length > 0 && (
        <ul className="mt-3 space-y-2">
          {existing.map((ident) => (
            <li
              key={ident.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2"
            >
              <span className="w-10 shrink-0">
                <GameCover title={ident.game?.name ?? "Game"} url={ident.game?.cover_url ?? null} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">
                  {ident.game?.name ?? "Unknown game"}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  {ident.in_game_name}
                  {ident.rank_label ? ` · ${ident.rank_label}` : ""}
                  {ident.region ? ` · ${ident.region}` : ""}
                  {ident.platform_slug ? ` · ${ident.platform_slug}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(ident.game_id)}
                aria-label={`Remove ${ident.game?.name ?? "game"} identity`}
                className="rounded-md p-2 text-text-muted transition-colors hover:bg-red-500/10 hover:text-sale"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
