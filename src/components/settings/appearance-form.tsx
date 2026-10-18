"use client";
// AppearanceForm — accent color personalization (user direction, 2026-10-18:
// "set their theme colors if they don't like the default"). Client-only like
// ThemeToggle: picks are persisted to localStorage (g4m37z-accent) and applied
// as [data-accent] on <html>, instant, no reload. Dark/light theme stays on
// the separate ThemeToggle.

import { useState } from "react";
import { useEffect } from "react";
import { Check, Palette } from "lucide-react";
import {
  ACCENTS,
  DEFAULT_ACCENT,
  applyAccent,
  readAccent,
  setAccent,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

export function AppearanceForm() {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [saved, setSaved] = useState(false);

  // Adopt the stored accent after hydration (same pattern as ThemeToggle —
  // first render matches the server; the attribute mutates post-commit, and
  // the React state defers via queueMicrotask to avoid an in-effect setState).
  useEffect(() => {
    applyAccent(readAccent());
    queueMicrotask(() => setAccentState(readAccent()));
  }, []);

  function pick(id: string) {
    setAccentState(id);
    setAccent(id);
    setSaved(true);
    // "Saved" is transient — the pick itself is already applied.
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Palette size={16} className="text-accent-text" />
        <h3 className="text-base font-bold text-fg">Accent color</h3>
        {saved && <span className="ml-auto text-xs text-success">Saved</span>}
      </div>
      <p className="mb-4 text-xs text-text-muted">
        The accent carries buttons, links and selection states. Your pick is
        saved on this device and applies instantly — dark or light stays on the
        theme toggle.
      </p>
      <ul className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent color">
        {ACCENTS.map((a) => {
          const active = a.id === accent;
          return (
            <li key={a.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pick(a.id)}
                className={cn(
                  "press flex min-h-[44px] items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft/50 text-fg"
                    : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-fg",
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 place-items-center rounded-full border border-white/20"
                  style={{ backgroundColor: a.swatch }}
                >
                  {active && <Check size={12} className="text-white" />}
                </span>
                {a.label}
                {a.id === DEFAULT_ACCENT && !active && (
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">
                    default
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
