"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTournamentAction } from "@/lib/tournaments/actions";
import { FrameworkSelector } from "./FrameworkSelector";
import {
  describeMatchFormat,
  describeScoring,
  suggestedFramework,
  type Framework,
} from "@/lib/tournaments/frameworks";

export function TournamentCreateForm({
  games,
  frameworks,
}: {
  games: { id: string; name: string; default_framework_id: string | null }[];
  frameworks: Framework[];
}) {
  const router = useRouter();
  const [gameId, setGameId] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = suggestedFramework(games, frameworks, gameId || null, selectedFramework);

  function onGameChange(value: string) {
    setGameId(value);
    // Surface the game's own "way of gaming" unless the organiser already
    // picked a framework deliberately.
    if (!selectedFramework) {
      const pick = suggestedFramework(games, frameworks, value || null, null);
      if (pick) setSelectedFramework(pick.id);
    }
  }

  function onSubmit(formData: FormData) {
    setError(null);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      gameId: formData.get("gameId")
        ? String(formData.get("gameId"))
        : null,
      frameworkId: selectedFramework,
      format:
        (String(formData.get("format") ?? "SINGLE_ELIMINATION") as
          | "SINGLE_ELIMINATION"
          | "DOUBLE_ELIMINATION"
          | "ROUND_ROBIN"
          | "SWISS"),
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
    <form
      action={onSubmit}
      className="mt-6 flex flex-col gap-6"
    >
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

        <label className="flex flex-col gap-1 sm:col-span-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Format
          </span>
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
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-text-muted">
            Framework (optional)
          </span>
          <Link
            href="/tournaments/frameworks/new"
            className="text-xs font-semibold text-accent-text hover:underline"
          >
            Create a custom framework
          </Link>
        </div>
        <FrameworkSelector
          frameworks={frameworks}
          selectedId={selectedFramework}
          onSelect={setSelectedFramework}
        />
        {selected && (describeScoring(selected) || describeMatchFormat(selected)) && (
          <div className="mt-2 rounded-md border border-border bg-bg p-2.5 text-xs text-text-secondary">
            <p className="font-semibold text-fg">{selected.name}</p>
            {describeScoring(selected) && <p>{describeScoring(selected)}</p>}
            {describeMatchFormat(selected) && <p>{describeMatchFormat(selected)}</p>}
          </div>
        )}
        <p className="text-xs text-text-muted">
          A framework sets the competition pipeline (stages, points, who
          advances). Pick one for framework-driven tournaments, or leave it
          unset to use the classic bracket format.
        </p>
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create tournament"}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          Tournaments start in REGISTRATION. Editing teams and matches happens
          from the tournament detail page once you are the organiser.
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