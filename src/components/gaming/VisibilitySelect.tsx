"use client";

// ============================================================================
// src/components/gaming/VisibilitySelect.tsx
// Owner control for profiles.gaming_visibility ('public' | 'followers' |
// 'private'). Drives the 052 RLS admission for user_games and
// game_platform_identities; unauthorized edits are impossible by policy.
// ============================================================================

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setGamingVisibilityAction } from "@/lib/gaming/actions";
import { GAMING_VISIBILITIES, type GamingVisibility } from "@/lib/gaming/types";

const LABELS: Record<GamingVisibility, string> = {
  public: "Public",
  followers: "Followers only",
  private: "Only me",
};

const HINTS: Record<GamingVisibility, string> = {
  public: "Anyone on G4M37Z can see your games and in-game identities.",
  followers: "Only people who follow you can see your gaming profile.",
  private: "Only you can see your gaming profile.",
};

export function VisibilitySelect({ initial }: { initial: GamingVisibility }) {
  const [value, setValue] = useState<GamingVisibility>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(v: GamingVisibility) {
    setError(null);
    setValue(v); // optimistic
    startTransition(async () => {
      const res = await setGamingVisibilityAction(v);
      if (!res.ok) {
        setError(res.error);
        setValue(initial); // revert
      }
    });
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Gaming profile visibility" className="flex flex-wrap gap-2">
        {GAMING_VISIBILITIES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => choose(v)}
            disabled={pending}
            className={`press inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
              value === v
                ? "border-accent bg-accent/10 text-accent-text"
                : "border-border text-text-secondary hover:border-border-strong hover:text-fg"
            }`}
          >
            {pending && value === v && <Loader2 size={12} className="animate-spin" />}
            {LABELS[v]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted">{HINTS[value]}</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
