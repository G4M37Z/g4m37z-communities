"use client";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "g4m37z-theme";

// V1 foundation note, corrected: the initial render MUST match the server
// (dark default) or React #418 hydration mismatch fires for light-stored
// users — the server cannot know localStorage. Storage is read in the
// effect below, after hydration, exactly once.
function readInitialDark(): boolean {
  return true;
}

export function ThemeToggle() {
  // Lazy initializer runs only once on mount; no cascading re-render.
  const [isDark, setIsDark] = useState<boolean>(readInitialDark);
  const mounted = useRef(false);

  // First run: adopt the stored preference (post-hydration, so server and
  // client first render agree). Every run after: sync the DOM attribute.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (window.localStorage.getItem(STORAGE_KEY) === "light") {
        // Defer adoption out of the effect's synchronous path. Same single
        // extra render as before, but the effect never sets state directly.
        queueMicrotask(() => setIsDark(false));
        return; // attribute is applied by the run this triggers
      }
    }
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
