"use client";
// FrameworkSelector — pick an existing framework during tournament creation.
// Presentational: the framework list is fetched server-side in the page and
// passed in, so this component never touches a server module.

import type { Framework } from "@/lib/tournaments/frameworks";
import { ChevronRight } from "lucide-react";

interface Props {
  frameworks: Framework[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FrameworkSelector({ frameworks, selectedId, onSelect }: Props) {
  if (frameworks.length === 0) {
    return (
      <div className="text-xs text-text-muted italic">
        No frameworks available. You can still create a tournament with a
        legacy format.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {frameworks.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={selectedId === f.id}
            className={`w-full flex items-center justify-between rounded-md p-3 text-left transition-all ${
              selectedId === f.id
                ? "border-accent bg-accent/10 ring-1 ring-accent"
                : "border border-border bg-surface hover:border-border-strong"
            }`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-fg">{f.name}</span>
                {f.category && (
                  <span className="rounded bg-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {f.category}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-secondary line-clamp-1">
                {f.description || "No description provided."}
              </span>
            </div>
            <ChevronRight size={16} className={selectedId === f.id ? "text-accent" : "text-text-muted"} />
          </button>
        </li>
      ))}
    </ul>
  );
}