"use client";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

const STORAGE_KEY = "g4m37z-theme";

// V1 foundation: derive initial theme synchronously from localStorage so we
// avoid a useEffect that synchronously calls setState (which triggers cascading
// renders per react-hooks/set-state-in-effect).
function readInitialDark(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? false : true;
}

export function ThemeToggle() {
  // Lazy initializer runs only once on mount; no cascading re-render.
  const [isDark, setIsDark] = useState<boolean>(readInitialDark);

  // Sync the DOM attribute whenever isDark changes (no setState in body).
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
  }, [isDark]);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    // Persist immediately; safe to call on every toggle.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="press inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors hover:text-fg"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
