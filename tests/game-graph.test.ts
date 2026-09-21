// Phase 2 — Game Graph tests.
//
// Conventions follow tests/gaming-identity.test.ts:
//   * pure shaping coverage (no live Supabase session required)
//   * migration regression so a future edit cannot silently drop the
//     SET NULL semantics, indexes, or nullable game edges.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __graph, type GraphPlayer } from "@/lib/games/graph";

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/053_game_graph.sql"),
  "utf8",
);

describe("migration 053 regression", () => {
  it("adds both game edges", () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE public\.communities\s+ADD COLUMN IF NOT EXISTS game_id/,
    );
    expect(MIGRATION).toMatch(
      /ALTER TABLE public\.posts\s+ADD COLUMN IF NOT EXISTS game_id/,
    );
  });

  it("uses ON DELETE SET NULL so content survives catalogue removal", () => {
    // Count only the actual REFERENCES clauses (the comment also mentions it).
    expect(
      MIGRATION.match(/REFERENCES public\.games\(id\) ON DELETE SET NULL/g)?.length,
    ).toBe(2);
  });

  it("indexes both edges for hub lookups", () => {
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS idx_communities_game/);
    expect(MIGRATION).toMatch(/CREATE INDEX IF NOT EXISTS idx_posts_game/);
  });

  it("touches no RLS state", () => {
    expect(MIGRATION.toLowerCase()).not.toContain("row level security");
    expect(MIGRATION.toLowerCase()).not.toContain("policy");
  });
});

describe("shapePlayers", () => {
  const profiles = {
    "u1": { username: "autotest", display_name: "Auto Test", avatar_url: null },
    "u2": { username: "autotest2", display_name: "Two", avatar_url: null },
  };

  it("collapses duplicate statuses to the highest priority", () => {
    const out = __graph.shapePlayers(
      [
        { user_id: "u1", status: "owned" },
        { user_id: "u1", status: "playing" },
      ],
      profiles,
      {},
    );
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("playing");
  });

  it("sorts playing before owned before followed", () => {
    const out = __graph.shapePlayers(
      [
        { user_id: "u2", status: "followed" },
        { user_id: "u1", status: "owned" },
        { user_id: "u3", status: "playing" },
      ],
      { ...profiles, u3: { username: "third", display_name: null, avatar_url: null } },
      {},
    );
    expect(out.map((p) => p.status)).toEqual(["playing", "owned", "followed"]);
  });

  it("attaches in-game names and drops unknown profiles", () => {
    const out = __graph.shapePlayers(
      [
        { user_id: "u1", status: "playing" },
        { user_id: "u-ghost", status: "playing" },
      ],
      profiles,
      { u1: "Tyrant" },
    );
    expect(out).toHaveLength(1);
    expect(out[0].in_game_name).toBe("Tyrant");
    expect(out[0].username).toBe("autotest");
  });

  it("ties break alphabetically by username", () => {
    const out: GraphPlayer[] = __graph.shapePlayers(
      [
        { user_id: "u2", status: "playing" },
        { user_id: "u1", status: "playing" },
      ],
      profiles,
      {},
    );
    expect(out.map((p) => p.username)).toEqual(["autotest", "autotest2"]);
  });
});

describe("shapeStats", () => {
  it("returns the hub header counts", () => {
    expect(__graph.shapeStats(3, 2, 7)).toEqual({
      players: 3,
      communities: 2,
      posts: 7,
    });
  });
});
