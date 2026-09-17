// Deterministic tests for manual, self-reported platform links.
//
// Covers the pure validation paths (no live Supabase session required) plus a
// regression check on the migration so a future edit cannot silently drop the
// per-user uniqueness constraint or loosen the owner-only write policies.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __platformLinks, PLATFORM_LABELS } from "@/lib/profiles/platform-links";

const { cleanPlatform, cleanHandle, cleanUrl } = __platformLinks;

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/042_platform_links.sql"),
  "utf8",
);

describe("cleanPlatform", () => {
  it("accepts the five supported platforms", () => {
    for (const p of ["steam", "playstation", "xbox", "google_play", "apple_game_center"]) {
      expect(cleanPlatform(p)).toBe(p);
    }
  });
  it("lowercases and trims", () => {
    expect(cleanPlatform("  Steam ")).toBe("steam");
  });
  it("rejects unknown platforms", () => {
    expect(cleanPlatform("nintendo")).toBeNull();
    expect(cleanPlatform("")).toBeNull();
    expect(cleanPlatform(null)).toBeNull();
  });
});

describe("cleanHandle", () => {
  it("accepts safe handle characters", () => {
    expect(cleanHandle("G4M37Z_Tyrant")).toBe("G4M37Z_Tyrant");
    expect(cleanHandle("cool.player-99")).toBe("cool.player-99");
    expect(cleanHandle("My Gamer Tag")).toBe("My Gamer Tag");
  });
  it("rejects empty, over-length, and unsafe input", () => {
    expect(cleanHandle("")).toBeNull();
    expect(cleanHandle("   ")).toBeNull();
    expect(cleanHandle("a".repeat(65))).toBeNull();
    expect(cleanHandle("bad<script>")).toBeNull();
    expect(cleanHandle("semi;colon")).toBeNull();
  });
});

describe("cleanUrl", () => {
  it("accepts https URLs and empty input", () => {
    expect(cleanUrl("https://steamcommunity.com/id/g4m37z")).toBe(
      "https://steamcommunity.com/id/g4m37z",
    );
    expect(cleanUrl("")).toBeNull();
    expect(cleanUrl(null)).toBeNull();
  });
  it("rejects http and non-URL input", () => {
    expect(cleanUrl("http://example.com")).toBeNull();
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a url")).toBeNull();
  });
});

describe("PLATFORM_LABELS", () => {
  it("has a label for every platform", () => {
    for (const p of ["steam", "playstation", "xbox", "google_play", "apple_game_center"] as const) {
      expect(PLATFORM_LABELS[p].length).toBeGreaterThan(0);
    }
  });
});

describe("042_platform_links.sql regression", () => {
  it("enforces one link per user per platform", () => {
    expect(MIGRATION).toMatch(/UNIQUE \(user_id, platform\)/);
  });
  it("keeps write policies owner-only", () => {
    expect(MIGRATION).toMatch(/platform_links_insert[\s\S]*?user_id = auth\.uid\(\)/);
    expect(MIGRATION).toMatch(/platform_links_update[\s\S]*?user_id = auth\.uid\(\)/);
    expect(MIGRATION).toMatch(/platform_links_delete[\s\S]*?user_id = auth\.uid\(\)/);
  });
  it("keeps verified_at nullable with no default (unverified by design)", () => {
    expect(MIGRATION).toMatch(/verified_at\s+TIMESTAMPTZ,/);
    expect(MIGRATION).not.toMatch(/verified_at\s+TIMESTAMPTZ[^,]*DEFAULT/);
  });
  it("restricts platform values", () => {
    expect(MIGRATION).toMatch(/platform IN\s*\(\s*'steam','playstation','xbox','google_play','apple_game_center'\s*\)/);
  });
});
