// Phase 1 — Gaming Identity tests.
//
// Conventions follow tests/platform-links.test.ts:
//   * pure validator coverage (no live Supabase session required)
//   * migration regression checks so a future edit cannot silently drop
//     the visibility RLS, owner-only write policies, or uniqueness rules
//     that the gaming identity layer depends on.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  __gaming,
  cleanStatus,
  cleanNote,
  cleanInGameName,
  cleanRankLabel,
  cleanRegion,
  cleanVisibility,
} from "@/lib/gaming/service";
import {
  GAME_STATUSES,
  GAME_STATUS_LABELS,
  LIBRARY_ORDER,
  GAMING_VISIBILITIES,
  type GameStatus,
  type GamingVisibility,
} from "@/lib/gaming/types";

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/052_gaming_identity.sql"),
  "utf8",
);

describe("gaming types", () => {
  it("status metadata is complete", () => {
    for (const s of GAME_STATUSES) {
      expect(GAME_STATUS_LABELS[s]).toBeTruthy();
    }
    // LIBRARY_ORDER is a curated render order — same members, own sequence.
    expect([...LIBRARY_ORDER].sort()).toEqual([...GAME_STATUSES].sort());
  });

  it("visibility set matches the migration CHECK", () => {
    expect(GAMING_VISIBILITIES).toEqual(["public", "followers", "private"]);
  });
});

describe("cleanStatus", () => {
  it("accepts the five statuses", () => {
    const expected: GameStatus[] = [
      "owned",
      "playing",
      "want_to_play",
      "favorite",
      "followed",
    ];
    for (const s of expected) expect(cleanStatus(s)).toBe(s);
  });
  it("rejects unknown or empty input", () => {
    expect(cleanStatus("beaten")).toBeNull();
    expect(cleanStatus("")).toBeNull();
    expect(cleanStatus(null)).toBeNull();
    expect(cleanStatus(42)).toBeNull();
  });
});

describe("cleanNote", () => {
  it("keeps short notes, trims empties to null", () => {
    expect(cleanNote("main sniper")).toBe("main sniper");
    expect(cleanNote("   ")).toBeNull();
    expect(cleanNote("")).toBeNull();
    expect(cleanNote(null)).toBeNull();
  });
  it("rejects over-length notes", () => {
    expect(cleanNote("a".repeat(281))).toBeNull();
    expect(cleanNote("a".repeat(280))).toBe("a".repeat(280));
  });
});

describe("cleanInGameName", () => {
  it("accepts safe names", () => {
    expect(cleanInGameName("G4M37Z_Tyrant")).toBe("G4M37Z_Tyrant");
    expect(cleanInGameName("player-99")).toBe("player-99");
  });
  it("rejects empty, over-length, and unsafe input", () => {
    expect(cleanInGameName("")).toBeNull();
    expect(cleanInGameName("a".repeat(65))).toBeNull();
    expect(cleanInGameName("bad<script>")).toBeNull();
    expect(cleanInGameName("semi;colon")).toBeNull();
  });
});

describe("cleanRankLabel and cleanRegion", () => {
  it("accepts sane labels", () => {
    expect(cleanRankLabel("Diamond IV")).toBe("Diamond IV");
    expect(cleanRegion("EU West")).toBe("EU West");
    expect(cleanRankLabel(null)).toBeNull();
    expect(cleanRegion("")).toBeNull();
  });
  it("rejects over-length or malformed values", () => {
    expect(cleanRankLabel("a".repeat(65))).toBeNull();
    expect(cleanRegion("a".repeat(17))).toBeNull();
    expect(cleanRegion("-starts-with-symbol")).toBeNull();
  });
});

describe("cleanVisibility", () => {
  it("accepts the three levels", () => {
    const expected: GamingVisibility[] = ["public", "followers", "private"];
    for (const v of expected) expect(cleanVisibility(v)).toBe(v);
  });
  it("rejects anything else", () => {
    expect(cleanVisibility("friends")).toBeNull();
    expect(cleanVisibility("")).toBeNull();
    expect(cleanVisibility(null)).toBeNull();
  });
});

describe("migration 052 regression", () => {
  it("enables RLS on both gaming tables", () => {
    expect(MIGRATION).toMatch(
      /ALTER TABLE public\.user_games ENABLE ROW LEVEL SECURITY/,
    );
    expect(MIGRATION).toMatch(
      /ALTER TABLE public\.game_platform_identities ENABLE ROW LEVEL SECURITY/,
    );
  });

  it("pins writes to the owner", () => {
    expect(MIGRATION.match(/WITH CHECK \(user_id = auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(MIGRATION.match(/USING \(user_id = auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("gates reads on the owner's gaming_visibility", () => {
    expect(MIGRATION).toMatch(/gaming_visibility = 'public'/);
    expect(MIGRATION).toMatch(/gaming_visibility = 'followers'/);
    expect(MIGRATION).toMatch(/public\.follows f/);
  });

  it("keeps per-user/status and per-user/game uniqueness", () => {
    expect(MIGRATION).toMatch(/UNIQUE \(user_id, game_id, status\)/);
    expect(MIGRATION).toMatch(/UNIQUE \(user_id, game_id\)/);
  });

  it("constrains status and visibility values", () => {
    expect(MIGRATION).toMatch(
      /status IN \('owned','playing','want_to_play','favorite','followed'\)/,
    );
    expect(MIGRATION).toMatch(
      /gaming_visibility IN \('public', 'followers', 'private'\)/,
    );
  });

  it("never stores credentials on identities", () => {
    expect(MIGRATION.toLowerCase()).not.toMatch(/password|token|secret|api_key/);
  });
});

describe("__gaming test surface", () => {
  it("exposes the validators", () => {
    expect(__gaming.cleanStatus).toBe(cleanStatus);
    expect(__gaming.cleanInGameName).toBe(cleanInGameName);
    expect(__gaming.GAME_STATUSES).toEqual(GAME_STATUSES);
  });
});
