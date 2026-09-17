"use client";
// FrameworkBuilder — UI for organizers to define their own tournament pipeline.
// Persists via createCustomFramework action.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createCustomFramework, type Framework, type ProgressionRule, type ScoringType } from "@/lib/tournaments/frameworks";

interface StageDraft {
  name: string;
  order: number;
  rule: { top_n?: number; min_points?: number; min_rank?: number };
}

export function FrameworkBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("General");
  const [scoringType, setScoringType] = useState<"points" | "win_loss" | "rank">("points");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([
    { name: "Stage 1", order: 1, rule: { top_n: 16 } },
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStage() {
    const nextOrder = stages.length + 1;
    setStages([...stages, { name: `Stage ${nextOrder}`, order: nextOrder, rule: { top_n: 8 } }]);
  }

  function removeStage(index: number) {
    const newStages = stages.filter((_, i) => i !== index);
    setStages(
      newStages.map((s, i) => ({ ...s, order: i + 1 }))
    );
  }

  function updateStage(index: number, field: keyof StageDraft, value: string | number) {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setStages(newStages);
  }

  function updateRule(index: number, field: keyof ProgressionRule, value: number | undefined) {
    const newStages = [...stages];
    newStages[index] = {
      ...newStages[index],
      rule: { ...newStages[index].rule, [field]: value },
    };
    setStages(newStages);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const res = await createCustomFramework({
      name,
      slug,
      category,
      scoring_type: scoringType,
      description,
      stages: stages.map((s) => ({
        name: s.name,
        order: s.order,
        rule: s.rule,
      })),
    });

    if (res.ok) {
      router.refresh();
      router.push("/settings");
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Framework Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. FNCS 2026 Style"
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Slug (URL)</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. fncs-2026"
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Category</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Fortnite"
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-text-muted">Scoring Type</span>
            <select
              value={scoringType}
              onChange={(e) => setScoringType(e.target.value as ScoringType)}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none"
            >
            <option value="points">Points-Based</option>
            <option value="win_loss">Win/Loss (Bracket)</option>
            <option value="rank">Rank-Based</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain how this framework works..."
          className="rounded-md border border-border bg-bg p-3 text-sm text-fg focus:border-accent focus:outline-none min-h-[80px]"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-fg">Stages Pipeline</h3>
          <button
            type="button"
            onClick={addStage}
            className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
          >
            <Plus size={14} /> Add Stage
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {stages.map((stage, i) => (
            <div key={i} className="relative rounded-lg border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-border text-[10px] font-bold text-text-muted">
                    {stage.order}
                  </span>
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => updateStage(i, "name", e.target.value)}
                    className="bg-transparent font-bold text-fg focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStage(i)}
                  className="text-text-muted hover:text-sale"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Top N Advance</span>
                <input
                  type="number"
                  value={stage.rule.top_n ?? ""}
                  onChange={(e) => updateRule(i, "top_n", parseInt(e.target.value) || undefined)}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Min Points</span>
                <input
                  type="number"
                  value={stage.rule.min_points ?? ""}
                  onChange={(e) => updateRule(i, "min_points", parseInt(e.target.value) || undefined)}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Min Rank</span>
                <input
                  type="number"
                  value={stage.rule.min_rank ?? ""}
                  onChange={(e) => updateRule(i, "min_rank", parseInt(e.target.value) || undefined)}
                  className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:border-accent focus:outline-none"
                />
              </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : "Create Framework"}
        </button>
        {error && <p role="alert" className="text-xs text-sale">{error}</p>}
      </div>
    </form>
  );
}
