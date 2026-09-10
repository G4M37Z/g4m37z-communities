"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLfgAction } from "@/lib/lfg/actions";

export function LfgCreateForm({
  games,
  platforms,
}: {
  games: { id: string; name: string }[];
  platforms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const payload = {
      gameId: formData.get("gameId") ? String(formData.get("gameId")) : null,
      platformId: formData.get("platformId")
        ? String(formData.get("platformId"))
        : null,
      mode: String(formData.get("mode") ?? "").trim() || null,
      region: String(formData.get("region") ?? "").trim() || null,
      skillLevel: String(formData.get("skill") ?? "").trim() || null,
      playersRequired: Number(formData.get("playersRequired") ?? 2),
      microphoneRequired: formData.get("microphone") === "on",
      language: String(formData.get("language") ?? "").trim() || null,
      sessionTime: String(formData.get("sessionTime") ?? "") || null,
      privacy: (formData.get("privacy") === "private" ? "private" : "public") as
        | "public"
        | "private",
    };

    startTransition(async () => {
      const res = await createLfgAction(payload);
      if (res.ok && res.sessionId) {
        router.push(`/lfg/${res.sessionId}`);
      } else {
        setError(res.error ?? "Failed to create session");
      }
    });
  }

  return (
    <form action={onSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Game (optional)
        </span>
        <select
          name="gameId"
          defaultValue=""
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        >
          <option value="">Any</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Platform (optional)
        </span>
        <select
          name="platformId"
          defaultValue=""
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        >
          <option value="">Any</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Mode
        </span>
        <input
          type="text"
          name="mode"
          maxLength={64}
          placeholder="e.g. Ranked, Casual"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Region
        </span>
        <input
          type="text"
          name="region"
          maxLength={64}
          placeholder="e.g. NA-East, EU"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Skill level
        </span>
        <input
          type="text"
          name="skill"
          maxLength={64}
          placeholder="e.g. Casual, Competitive"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Language
        </span>
        <input
          type="text"
          name="language"
          maxLength={32}
          placeholder="e.g. English"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Players required *
        </span>
        <input
          type="number"
          name="playersRequired"
          min={1}
          max={100}
          defaultValue={2}
          required
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Session time
        </span>
        <input
          type="datetime-local"
          name="sessionTime"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Privacy
        </span>
        <select
          name="privacy"
          defaultValue="public"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          name="microphone"
          className="h-4 w-4 rounded border border-border bg-surface text-accent focus:ring-accent"
        />
        <span className="text-sm text-fg">Microphone required</span>
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Host session"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-sale">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
