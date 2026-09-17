"use client";
// FrameworkSelector — UI for picking an existing framework during tournament creation.
// Displays a list of frameworks with their categories and basic rules.

import { useState, useEffect } from "react";
import { listFrameworks, type Framework } from "@/lib/tournaments/frameworks";
import { ChevronRight } from "lucide-react";

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FrameworkSelector({ selectedId, onSelect }: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFrameworks() {
      const data = await listFrameworks();
      setFrameworks(data);
      setLoading(false);
    }
    fetchFrameworks();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-10 text-xs text-text-muted animate-pulse">
        Loading frameworks...
      </div>
    );
  }

  if (frameworks.length === 0) {
    return (
      <div className="text-xs text-text-muted italic">No frameworks available.</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {frameworks.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onSelect(f.id)}
          className={`flex items-center justify-between rounded-md p-3 text-left transition-all ${
            selectedId === f.id
              ? "border-accent bg-accent/10 ring-1 ring-accent"
              : "border border-border bg-surface hover:border-border-strong"
          }`}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-fg">{f.name}</span>
              <span className="rounded bg-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                {f.category}
              </span>
            </div>
            <span className="text-xs text-text-secondary line-clamp-1">
              {f.description || "No description provided."}
            </span>
          </div>
          <ChevronRight size={16} className={selectedId === f.id ? "text-accent" : "text-text-muted"} />
        </button>
      ))}
    </div>
  );
}
