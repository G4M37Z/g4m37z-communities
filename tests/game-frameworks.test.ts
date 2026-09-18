// Deterministic tests for the per-game "way of gaming" feature
// (SPEC-tournament-formats.md addendum; migration 044_game_frameworks.sql).
//
// Covers the pure scoring/match-format renderers, the game→default-framework
// resolution, and a regression check on 044 so a future edit cannot drop the
// idempotence guards, unbind a seeded game, or reintroduce a broken
// tournaments.creator_id reference.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeScoring,
  describeMatchFormat,
  suggestedFramework,
  type Framework,
  type ScoringSchedule,
  type GameMatchFormat,
} from "@/lib/tournaments/frameworks";

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/044_game_frameworks.sql"),
  "utf8",
);

function fw(overrides: Partial<Framework>): Framework {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    slug: "x",
    name: "X",
    category: null,
    scoring_type: "points",
    description: null,
    game_id: null,
    scoring_schedule: null,
    match_format: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function schedule(s: Partial<ScoringSchedule>): ScoringSchedule {
  return {
    per_match: false,
    ...s,
  };
}

function matchFormat(m: Partial<GameMatchFormat>): GameMatchFormat {
  return { mode: "single", ...m };
}

describe("describeScoring", () => {
  it("renders a football 3-1-0 schedule with its tiebreak chain", () => {
    const text = describeScoring({
      scoring_schedule: schedule({
        win: 3,
        draw: 1,
        loss: 0,
        tiebreak: ["goal_difference", "goals_for", "head_to_head"],
      }),
    });
    expect(text).toContain("Win 3 pts, draw 1, loss 0");
    expect(text).toContain("ties broken by goal difference, goals scored, head-to-head");
  });

  it("renders a battle royale placement + kills + match count schedule", () => {
    const text = describeScoring({
      scoring_schedule: schedule({
        placement: [15, 12, 10, 8, 6, 4, 3, 2, 1],
        kill_points: 1,
        per_match: true,
        matches: 6,
      }),
    });
    expect(text).toContain("Placement 1st: 15, 2nd: 12, 3rd: 10 · 9th: 1");
    expect(text).toContain("1 per elimination");
    expect(text).toContain("over 6 matches");
  });

  it("renders an FNCS top-25 placement table", () => {
    const text = describeScoring({
      scoring_schedule: schedule({
        placement: [65, 56, 52, 48, 44, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2],
        kill_points: 2,
        per_match: true,
        matches: 12,
      }),
    });
    expect(text).toContain("Placement 1st: 65, 2nd: 56, 3rd: 52 · 25th: 2");
    expect(text).toContain("2 per elimination");
  });

  it("renders series win points", () => {
    expect(
      describeScoring({ scoring_schedule: schedule({ win_points: 1, loss_points: 0 }) }),
    ).toBe("1 per series win");
  });

  it("returns null for an empty schedule", () => {
    expect(describeScoring({})).toBeNull();
    expect(describeScoring({ scoring_schedule: null })).toBeNull();
  });
});

describe("describeMatchFormat", () => {
  it("renders a best-of with a fixed mode rotation (CDL)", () => {
    expect(
      describeMatchFormat({
        match_format: matchFormat({
          mode: "best_of",
          games: 5,
          modes: ["Hardpoint", "Search & Destroy", "Control", "Hardpoint", "Search & Destroy"],
        }),
      }),
    ).toBe(
      "Best-of-5 (Hardpoint → Search & Destroy → Control → Hardpoint → Search & Destroy)",
    );
  });

  it("renders fighting best-of-3 with best-of-5 finals", () => {
    expect(
      describeMatchFormat({
        match_format: matchFormat({ mode: "best_of", games: 3, finals_games: 5 }),
      }),
    ).toBe("Best-of-3 · finals best-of-5");
  });

  it("renders racing and multi-match session lengths", () => {
    expect(describeMatchFormat({ match_format: matchFormat({ mode: "racing", matches: 5 }) })).toBe(
      "5 races per round",
    );
    expect(
      describeMatchFormat({ match_format: matchFormat({ mode: "multi_match", matches: 12 }) }),
    ).toBe("12 matches per round");
  });

  it("returns null without a format", () => {
    expect(describeMatchFormat({})).toBeNull();
    expect(describeMatchFormat({ match_format: null })).toBeNull();
  });
});

describe("suggestedFramework", () => {
  const games = [
    { id: "g-pubg", default_framework_id: "f-pubg" },
    { id: "g-mk", default_framework_id: "f-mk" },
    { id: "g-orphan", default_framework_id: "f-other" },
    { id: "g-none", default_framework_id: null },
  ];
  const frameworks = [
    fw({ id: "f-pubg", game_id: "g-pubg", name: "PUBG Points System" }),
    fw({ id: "f-mk", game_id: "g-mk", name: "Fighting Double-Elim" }),
  ];

  it("returns the game's default framework when nothing is selected", () => {
    const pick = suggestedFramework(games, frameworks, "g-pubg", null);
    expect(pick?.id).toBe("f-pubg");
    expect(pick?.name).toBe("PUBG Points System");
  });

  it("respects an explicit selection over the game default", () => {
    const pick = suggestedFramework(games, frameworks, "g-pubg", "f-mk");
    expect(pick?.id).toBe("f-mk");
  });

  it("returns null when the game has no default or is unknown", () => {
    expect(suggestedFramework(games, frameworks, "g-none", null)).toBeNull();
    expect(suggestedFramework(games, frameworks, "unknown-game", null)).toBeNull();
    expect(suggestedFramework(games, frameworks, null, null)).toBeNull();
  });

  it("ignores a default pointing at a framework for a different game", () => {
    expect(suggestedFramework(games, frameworks, "g-orphan", null)).toBeNull();
  });
});

describe("044_game_frameworks.sql regression", () => {
  it("links frameworks to games and defaults games to a framework", () => {
    expect(MIGRATION).toMatch(/game_id\s+UUID REFERENCES public\.games\(id\)/);
    expect(MIGRATION).toMatch(/default_framework_id\s+UUID REFERENCES public\.tournament_frameworks\(id\)/);
  });

  it("bounds match_format mode to the supported set", () => {
    expect(MIGRATION).toMatch(
      /match_format->>'mode'[\s\S]*IN \('single', 'best_of', 'multi_match', 'league', 'racing'\)/,
    );
  });

  it("seeds the games catalogue without assuming a unique slug constraint", () => {
    expect(MIGRATION).toMatch(/INSERT INTO public\.games[\s\S]*?WHERE NOT EXISTS[\s\S]*?g\.slug = s\.slug/);
  });

  it("guards catalogue joins against re-insertion", () => {
    expect(MIGRATION).toMatch(
      /INSERT INTO public\.game_genres[\s\S]*?WHERE NOT EXISTS[\s\S]*?gg\.game_id = g\.id[\s\S]*?gg\.genre_id = ge\.id/,
    );
    expect(MIGRATION).toMatch(
      /INSERT INTO public\.game_platforms[\s\S]*?WHERE NOT EXISTS[\s\S]*?gp\.game_id = g\.id[\s\S]*?gp\.platform_id = p\.id/,
    );
  });

  it("seeds one way-of-gaming framework per game and is idempotent", () => {
    const defs = MIGRATION.match(/\(\s*'[a-z-]+',\s*'([a-z-]+-points|cdl-series|[a-z-]+-double-elim|[a-z-]+-league|[a-z-]+-knockout|[a-z-]+-pro-cup|fncs-style-points|gta-racing-cup|roblox-multi-experience)'/g);
    expect(defs).not.toBeNull();
    expect(MIGRATION).toMatch(/ON CONFLICT \(slug\) DO NOTHING/);
  });

  it("gives every seeded game a default framework via guarded update", () => {
    expect(MIGRATION).toMatch(
      /UPDATE public\.games g[\s\S]*?SET default_framework_id = fw\.id[\s\S]*?ON [\s\S]*?WHERE g\.slug = d\.game_slug AND g\.default_framework_id IS NULL/,
    );
    const block = MIGRATION.match(/UPDATE public\.games g[\s\S]*?\) AS d\(game_slug, fw_slug\)/);
    expect(block).toBeTruthy();
    const pairs = block![0].match(/\(\s*'[a-z0-9-]+',\s*'[a-z0-9-]+'\)/g);
    expect(pairs).toBeTruthy();
    expect(pairs!.length).toBe(8);
  });

  it("keeps stage seeds idempotent per (framework, order)", () => {
    expect(MIGRATION).toMatch(/INSERT INTO public\.tournament_stages[\s\S]*?ON CONFLICT \(framework_id, stage_order\) DO NOTHING/);
  });

  it("never references the legacy tournaments.creator_id column", () => {
    expect(MIGRATION).not.toMatch(/tournaments\.creator_id|t\.creator_id/);
  });
});