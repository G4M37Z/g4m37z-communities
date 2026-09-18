// Deterministic tests for tournament frameworks (SPEC-tournament-formats.md).
//
// Covers the pure scoring/progression engine plus a regression check on the
// 043 migration so a future edit cannot silently drop the uniqueness
// constraints, reintroduce the broken `tournaments.creator_id` reference, or
// make the legacy "classic" seed non-idempotent.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateAdvancement, type ScoreEntry, type ProgressionRule } from "@/lib/tournaments/frameworks";

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/043_tournament_frameworks.sql"),
  "utf8",
);

function scores(...pairs: [string, number, number][]): ScoreEntry[] {
  return pairs.map(([userId, points, rank]) => ({ userId, points, rank }));
}

describe("calculateAdvancement", () => {
  it("advances the top N by points, descending", () => {
    const entries = scores(
      ["a", 25, 0],
      ["b", 90, 0],
      ["c", 40, 0],
      ["d", 10, 0],
    );
    expect(calculateAdvancement(entries, { top_n: 2 })).toEqual(["b", "c"]);
  });

  it("breaks point ties by better (lower) rank", () => {
    const entries = scores(
      ["a", 50, 5],
      ["b", 50, 1],
      ["c", 30, 2],
    );
    // b and a are tied on points; b has the better rank so it advances first.
    expect(calculateAdvancement(entries, { top_n: 2 })).toEqual(["b", "a"]);
  });

  it("filters out entries below min_points before cutting to top N", () => {
    const entries = scores(
      ["a", 60, 0],
      ["b", 45, 0],
      ["c", 30, 0],
      ["d", 12, 0],
    );
    expect(calculateAdvancement(entries, { top_n: 3, min_points: 40 })).toEqual(["a", "b"]);
  });

  it("filters out entries worse than min_rank before cutting to top N", () => {
    const entries = scores(
      ["a", 100, 1],
      ["b", 90, 2],
      ["c", 80, 6],
      ["d", 70, 8],
    );
    expect(calculateAdvancement(entries, { top_n: 10, min_rank: 5 })).toEqual(["a", "b"]);
  });

  it("returns an empty list when the rule is empty", () => {
    expect(calculateAdvancement(scores(["a", 100, 0]), {})).toEqual([]);
    expect(calculateAdvancement(scores(["a", 100, 0]), {} as ProgressionRule)).toEqual([]);
  });

  it("returns an empty list when there are no scores", () => {
    expect(calculateAdvancement([], { top_n: 10 })).toEqual([]);
  });

  it("does not exceed the number of entries when top_n is huge", () => {
    const entries = scores(["a", 10, 0], ["b", 5, 0]);
    expect(calculateAdvancement(entries, { top_n: 999 })).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const entries = scores(["a", 10, 0], ["b", 5, 0], ["c", 20, 0]);
    const before = entries.map((e) => e.userId);
    calculateAdvancement(entries, { top_n: 2 });
    expect(entries.map((e) => e.userId)).toEqual(before);
  });
});

describe("043_tournament_frameworks.sql regression", () => {
  it("declares framework slugs unique", () => {
    expect(MIGRATION).toMatch(/slug\s+TEXT NOT NULL UNIQUE/);
    expect(MIGRATION).toMatch(/UNIQUE \(slug\)|slug\)[^)]*UNIQUE|slug[^(]*UNIQUE/i);
  });

  it("declares stage order unique within a framework", () => {
    expect(MIGRATION).toMatch(/UNIQUE\s*\(framework_id,\s*stage_order\)/);
  });

  it("keeps stage_order constrained to >= 1", () => {
    expect(MIGRATION).toMatch(/stage_order\s+INT NOT NULL CHECK \(stage_order >= 1\)/);
  });

  it("gates framework inserts on created_by = auth.uid()", () => {
    expect(MIGRATION).toMatch(/frameworks_insert[\s\S]*?created_by = auth\.uid\(\)/);
  });

  it("gates stage inserts on ownership of the parent framework", () => {
    expect(MIGRATION).toMatch(
      /stages_insert[\s\S]*?tournament_frameworks[\s\S]*?created_by = auth\.uid\(\)/,
    );
  });

  it("gates score writes through organiser ownership (communities.creator_id), never tournaments.creator_id", () => {
    const policy = MIGRATION.match(/CREATE POLICY scores_upsert[\s\S]*?;/);
    expect(policy).toBeTruthy();
    const block = policy![0];
    expect(block).toMatch(/c\.creator_id = auth\.uid\(\)/);
    expect(block).not.toMatch(/t\.creator_id|tournaments\.creator_id/);
  });

  it("keeps the legacy stage seed idempotent across re-runs", () => {
    expect(MIGRATION).toMatch(/INSERT INTO public\.tournament_stages[\s\S]*?ON CONFLICT[\s\S]*?DO NOTHING/);
  });
});