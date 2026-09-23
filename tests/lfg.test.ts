// Phase 3 — LFG wiring tests.
//
// LFG itself (sessions, participants, joinVerdict) shipped earlier; Phase 3
// wires it into the game hubs. These tests pin the new integration points:
//   * the /lfg/new?game= prefill contract (only catalogue-known ids pass)
//   * the hub section queries open statuses only (via the service's
//     documented behavior through joinVerdict + status list regression)
// Migration regression: the game-scoped index hub queries rely on.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { joinVerdict } from "../src/lib/lfg/service";

const root = process.cwd();
const newPage = readFileSync(
  join(root, "src/app/lfg/new/page.tsx"),
  "utf8",
);
const hubPage = readFileSync(
  join(root, "src/app/game/[slug]/page.tsx"),
  "utf8",
);
const lfgPage = readFileSync(join(root, "src/app/lfg/page.tsx"), "utf8");

describe("LFG hub wiring (Phase 3)", () => {
  it("prefill accepts only ids the catalogue knows (validated server-side)", () => {
    // The page must compare against the fetched catalogue, not trust the URL.
    expect(newPage).toContain("games.some((g) => g.id === sp.game)");
    // And pass the preset into the form, falling back to the default.
    expect(newPage).toContain("presetGameId={presetGameId}");
  });

  it("form defaults the game select to the preset", () => {
    const form = readFileSync(
      join(root, "src/components/lfg/LfgCreateForm.tsx"),
      "utf8",
    );
    expect(form).toContain('defaultValue={presetGameId ?? ""}');
  });

  it("hub section lists open sessions and deep-links the host CTA with the game", () => {
    expect(hubPage).toContain("listLfgSessions(supabase, {");
    expect(hubPage).toContain('status: ["CREATED", "OPEN"]');
    expect(hubPage).toContain("Host a session");
    expect(hubPage).toContain("Host the first one");
    expect(hubPage).toContain("`/lfg/new?game=${game.id}`");
  });

  it("discover cards link known games back to their hub", () => {
    expect(lfgPage).toContain("s.game_slug");
    expect(lfgPage).toContain("`/game/${s.game_slug}`");
  });
});

describe("LFG joinVerdict (existing service contract)", () => {
  const base = {
    status: "OPEN" as const,
    playersRequired: 4,
    hostId: "d1eeb9c0-0000-4000-8000-000000000007",
    userId: "d1eeb9c0-0000-4000-8000-000000000008",
    currentCount: 0,
  };

  it("admits a joiner to an open session", () => {
    expect(joinVerdict(base)).toBe("joinable");
  });

  it("rejects the host joining their own session", () => {
    expect(joinVerdict({ ...base, userId: base.hostId })).toBe("forbidden");
  });

  it("reports full when capacity is reached", () => {
    expect(
      joinVerdict({ ...base, currentCount: base.playersRequired }),
    ).toBe("full");
  });

  it("rejects terminal statuses", () => {
    expect(joinVerdict({ ...base, status: "CLOSED" })).toBe("unavailable");
    expect(joinVerdict({ ...base, status: "CANCELLED" })).toBe("unavailable");
  });
});

describe("migration regression (016/023 invariants)", () => {
  const policies = readFileSync(
    join(root, "docs/database/016_lfg_policies.sql"),
    "utf8",
  );
  const master = readFileSync(join(root, "sql/master_v3.sql"), "utf8");

  it("keeps the game index hub queries depend on", () => {
    // Created by master_v3.sql, verified live in pg_indexes.
    expect(master).toContain("idx_lfg_sessions_game ON lfg_sessions(game_id)");
  });

  it("keeps public SELECT for non-private sessions (hub discovery)", () => {
    expect(policies).toMatch(/SELECT/i);
    expect(policies).toContain("privacy");
  });
});
