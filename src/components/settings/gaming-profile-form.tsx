"use client";
// GamingProfileForm — V4 gaming identity editor (022_v4_gaming_profiles.sql).
// Persists via updateGamingProfileAction; covers gaming_handle, platforms,
// favorite_games (tags), play_style, and lfg_available.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Check } from "lucide-react";
import { updateGamingProfileAction } from "@/lib/profiles/actions";

interface Props {
  initial?: {
    gaming_handle: string | null;
    platforms: string[] | null;
    favorite_games: string[] | null;
    play_style: string | null;
    lfg_available: boolean;
  } | null;
}

const PLATFORM_OPTIONS = ["pc", "playstation", "xbox", "switch", "mobile", "cloud"];
const PLAY_STYLE_OPTIONS = ["casual", "competitive", "hardcore", "streamer", "chill", "ranked"];

export function GamingProfileForm({ initial = null }: Props) {
  const router = useRouter();
  const [handle, setHandle] = useState(initial?.gaming_handle ?? "");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
  const [favoriteGames, setFavoriteGames] = useState(initial?.favorite_games?.join(", ") ?? "");
  const [playStyle, setPlayStyle] = useState(initial?.play_style ?? "");
  const [lfg, setLfg] = useState(initial?.lfg_available ?? false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].slice(0, 6),
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const games = favoriteGames
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 12);

    startTransition(async () => {
      const res = await updateGamingProfileAction({
        gaming_handle: handle.trim() || null,
        platforms,
        favorite_games: games,
        play_style: playStyle || null,
        lfg_available: lfg,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gamepad2 size={16} className="text-accent" />
        <h3 className="text-base font-bold text-fg">Gaming Profile</h3>
        {saved && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <Check size={12} /> Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Gaming handle</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={32}
            placeholder="e.g. G4M37Z_Tyrant"
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Play style</span>
          <select
            value={playStyle}
            onChange={(e) => setPlayStyle(e.target.value)}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">—</option>
            {PLAY_STYLE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <span className="text-xs uppercase tracking-wider text-text-muted">Platforms</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PLATFORM_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              aria-pressed={platforms.includes(p)}
              className={`press rounded-md px-2.5 py-1 text-xs capitalize ${
                platforms.includes(p)
                  ? "bg-accent text-white"
                  : "border border-border bg-bg text-text-secondary hover:text-fg"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Favorite games (comma-separated)
        </span>
        <input
          type="text"
          value={favoriteGames}
          onChange={(e) => setFavoriteGames(e.target.value)}
          maxLength={400}
          placeholder="e.g. Elden Ring, Helldivers 2"
          className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={lfg}
          onChange={(e) => setLfg(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-bg text-accent focus:ring-accent"
        />
        <span className="text-sm text-fg">Available for LFG (looking-for-group) sessions</span>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save gaming profile"}
        </button>
        {error && <p role="alert" className="text-xs text-sale">{error}</p>}
      </div>
    </form>
  );
}