// ============================================================================
// src/lib/appearance.ts
// Accent personalization (user direction, 2026-10-18: "custom theme colors").
// Client-only, mirroring ThemeToggle (g4m37z-theme) exactly: server HTML never
// depends on the accent, the CSS default is PlayStation blue, and the stored
// choice is adopted after hydration (one repaint, same trade-off as stored
// light users). Applied as [data-accent] on <html>; overrides live in
// globals.css AFTER the theme blocks and cover both light paths.
// ============================================================================
"use client";

export interface AccentOption {
  id: string;
  label: string;
  swatch: string;
}

/** Built-in accents. `ps-blue` is the default — applying it removes the
 * attribute entirely so the CSS base wins (no duplicate source of truth). */
export const ACCENTS: AccentOption[] = [
  { id: "ps-blue", label: "PlayStation Blue", swatch: "#0070D1" },
  { id: "terracotta", label: "Terracotta", swatch: "#C2542A" },
  { id: "emerald", label: "Emerald", swatch: "#047857" },
  { id: "violet", label: "Violet", swatch: "#6D28D9" },
  { id: "rose", label: "Rose", swatch: "#BE123C" },
  { id: "gold", label: "Gold", swatch: "#B45309" },
];

export const DEFAULT_ACCENT = ACCENTS[0]!.id;
const KEY = "g4m37z-accent";

export function isAccentId(id: string | null): id is string {
  return ACCENTS.some((a) => a.id === id);
}

/** Stored preference (or the default after the first pick). */
export function readAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(KEY);
  return isAccentId(stored) ? stored : DEFAULT_ACCENT;
}

/** Write the attribute; the default clears it so base tokens stay authoritative. */
export function applyAccent(id: string): void {
  if (typeof document === "undefined") return;
  if (id === DEFAULT_ACCENT) {
    document.documentElement.removeAttribute("data-accent");
  } else if (isAccentId(id)) {
    document.documentElement.setAttribute("data-accent", id);
  }
}

/** Persist + apply. localStorage-first, same contract as ThemeToggle. */
export function setAccent(id: string): void {
  if (typeof window === "undefined") return;
  try {
    if (id === DEFAULT_ACCENT) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    // Private mode etc. — still apply visually for this session.
  }
  applyAccent(id);
}
