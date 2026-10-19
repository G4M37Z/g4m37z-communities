"use client";
// TournamentCreateForm — game-first creation. Selecting a game applies its
// hosting format (the framework pipeline with stages, points and progression)
// as the tournament's format, engraved into creation. A classic bracket can
// still be chosen explicitly via the opt-out below the pipeline.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { createTournamentAction } from "@/lib/tournaments/actions";
import {
  describeMatchFormat,
  describeScoring,
  suggestedFramework,
  type Framework,
  type Stage,
} from "@/lib/tournaments/frameworks";

type LegacyFormat =
  | "SINGLE_ELIMINATION"
  | "DOUBLE_ELIMINATION"
  | "ROUND_ROBIN"
  | "SWISS";

export function TournamentCreateForm({
  games,
  frameworks,
  stagesByFramework,
}: {
  games: { id: string; name: string; default_framework_id: string | null }[];
  frameworks: Framework[];
  stagesByFramework: Record<string, Stage[]>;
}) {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [useClassicBracket, setUseClassicBracket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const game = games.find((g) => g.id === gameId) ?? null;
  // Only this game's hosting formats — never a template gallery.
  const gameFormats = frameworks.filter(
    (f) => f.game_id !== null && f.game_id === gameId,
  );
  const selected = useClassicBracket
    ? null
    : suggestedFramework(games, frameworks, gameId || null, selectedFramework);
  const pipeline = selected ? (stagesByFramework[selected.id] ?? []) : [];

  function onGameChange(value: string) {
    setGameId(value);
    // Engrave: surface the game's own "way of gaming", unless the organiser
    // already picked a format deliberately.
    if (!selectedFramework) {
      const pick = suggestedFramework(games, frameworks, value || null, null);
      if (pick) setSelectedFramework(pick.id);
    }
  }

  function onClassicToggle(e: React.ChangeEvent<HTMLInputElement>) {
    setUseClassicBracket(e.target.checked);
    if (e.target.checked) setSelectedFramework(null);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      gameId: formData.get("gameId") ? String(formData.get("gameId")) : null,
      frameworkId: useClassicBracket ? null : selectedFramework,
      format:
        (String(formData.get("format") ?? "SINGLE_ELIMINATION") as LegacyFormat),
      maxTeams: formData.get("maxTeams")
        ? Number(formData.get("maxTeams"))
        : undefined,
    };
    startTransition(async () => {
      const res = await createTournamentAction(payload);
      if (res.ok && res.id) {
        router.push(`/tournaments/${res.id}`);
      } else {
        setError(res.error ?? "Failed to create tournament");
      }
    });
  }

  return (
    <form action={onSubmit} className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Tournament name *
          </span>
          <input
            type="text"
            name="name"
            maxLength={200}
            required
            placeholder="e.g. Spring Cup 2026"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Game *
          </span>
          <select
            name="gameId"
            required
            value={gameId}
            onChange={(e) => onGameChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">Select a game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Max teams (2..128)
          </span>
          <input
            type="number"
            name="maxTeams"
            min={2}
            max={128}
            defaultValue={8}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          />
        </label>
      </div>

      {/* Game's hosting format — engraved, visible, pre-selected */}
      {!useClassicBracket && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              {game ? `${game.name} format` : "Format"}
            </span>
            <Link
              href={
                gameId
                  ? `/tournaments/frameworks/new?game=${gameId}`
                  : "/tournaments/frameworks/new"
              }
              className="text-xs font-semibold text-accent-text hover:underline"
            >
              Define a new format
            </Link>
          </div>

          {gameFormats.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-3 text-xs text-text-muted">
              This game has no hosting format yet — an admin can define one
              (its official esports style, or a server / roleplay format for
              non-competitive titles). You can still{" "}
              <label className="font-semibold text-fg underline">
                use a classic bracket below
              </label>
              .
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {gameFormats.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedFramework(f.id)}
                      aria-pressed={selected?.id === f.id}
                      className={`w-full flex items-center justify-between rounded-md p-3 text-left transition-all ${
                        selected?.id === f.id
                          ? "border-accent bg-accent/10 ring-1 ring-accent"
                          : "border border-border bg-surface hover:border-border-strong"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-fg">
                            {f.name}
                          </span>
                          {f.is_official && (
                            <span className="inline-flex items-center gap-1 rounded bg-accent-soft/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-text">
                              <Award size={10} aria-hidden="true" /> Official
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary line-clamp-1">
                          {f.description || "No description provided."}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className={selected?.id === f.id ? "text-accent" : "text-text-muted"}
                      />
                    </button>
                  </li>
                ))}
              </ul>

              {selected && (
                <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-secondary">
                  <p className="font-semibold text-fg">{selected.name}</p>
                  {describeScoring(selected) && <p>{describeScoring(selected)}</p>}
                  {describeMatchFormat(selected) && (
                    <p>{describeMatchFormat(selected)}</p>
                  )}
                  {pipeline.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Pipeline
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {pipeline.map((stage, i) => (
                          <span key={stage.id} className="flex items-center gap-1">
                            {i > 0 && (
                              <ChevronRight size={12} className="text-text-muted" />
                            )}
                            <span className="rounded bg-border px-1.5 py-0.5 text-[11px] text-fg">
                              {stage.stage_name}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={useClassicBracket}
                  onChange={onClassicToggle}
                  className="h-3.5 w-3.5 accent-accent"
                />
                Use a classic bracket instead (single/double elimination, round
                robin, Swiss)
              </label>
            </>
          )}
        </div>
      )}

      {useClassicBracket && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              Format
            </span>
            <label className="flex items-center gap-2 text-xs font-semibold text-fg">
              <input
                type="checkbox"
                checked={useClassicBracket}
                onChange={onClassicToggle}
                className="h-3.5 w-3.5 accent-accent"
              />
              Using classic bracket
            </label>
          </div>
          <select
            name="format"
            defaultValue="SINGLE_ELIMINATION"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="SINGLE_ELIMINATION">Single elimination</option>
            <option value="DOUBLE_ELIMINATION">Double elimination</option>
            <option value="ROUND_ROBIN">Round robin</option>
            <option value="SWISS">Swiss</option>
          </select>
        </div>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create tournament"}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          Tournaments start in REGISTRATION. Editing teams, scores and matches
          happens from the tournament detail page once you are the organiser.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-sale">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
