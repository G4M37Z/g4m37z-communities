// Deterministic tests for the V3.7 Creators service.
//
// Covers pure input-validation / verdict paths and the documented
// authorization contract sourced from the committed RLS migration. DB-layer
// code paths (follow counts, content CRUD against the live DB) run at
// integration time and are not exercised here.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __test, CONTENT_TYPES, followVerdict, type FollowVerdict } from "@/lib/creators/service";

const { isUuid, clamp, validateProfileInput, validateContentInput, MAX_PROFILE_BIO_LEN, MAX_CONTENT_TITLE_LEN } = __test;

const CREATORS_POLICIES = readFileSync(
  join(process.cwd(), "docs/database/019_creators_policies.sql"),
  "utf8",
);

describe("creators UUID / bounds (pure helpers)", () => {
  it("isUuid() accepts canonical UUIDs and rejects malformed values", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("clamp() bounds page sizes to [1, 50]", () => {
    expect(clamp(0, 1, 50)).toBe(1);
    expect(clamp(999, 1, 50)).toBe(50);
    expect(clamp(24, 1, 50)).toBe(24);
  });
});

describe("creators content types", () => {
  it("exposes the documented content types", () => {
    expect(CONTENT_TYPES).toEqual(["post", "clip", "guide", "review"]);
  });
});

describe("validateProfileInput", () => {
  it("accepts a valid display name and bio", () => {
    const verdict = validateProfileInput({ displayName: "  GameM4k3r  ", bio: "Hello!" });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.value.displayName).toBe("GameM4k3r");
      expect(verdict.value.bio).toBe("Hello!");
    }
  });

  it("rejects an over-long bio", () => {
    const verdict = validateProfileInput({ bio: "x".repeat(MAX_PROFILE_BIO_LEN + 1) });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/too long/i);
  });

  it("rejects an over-long display name", () => {
    const verdict = validateProfileInput({ displayName: "y".repeat(81) });
    expect(verdict.ok).toBe(false);
  });
});

describe("validateContentInput", () => {
  it("accepts a valid post", () => {
    const verdict = validateContentInput({ contentType: "guide", title: "  Movement guide  ", gameId: "00000000-0000-4000-8000-000000000002" });
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.value.title).toBe("Movement guide");
      expect(verdict.value.published).toBe(false);
    }
  });

  it("rejects an unknown content type", () => {
    expect(validateContentInput({ contentType: "rant", title: "x" }).ok).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(validateContentInput({ contentType: "post", title: "   " }).ok).toBe(false);
  });

  it("rejects an over-long title and a malformed gameId", () => {
    expect(validateContentInput({ contentType: "post", title: "x".repeat(MAX_CONTENT_TITLE_LEN + 1) }).ok).toBe(false);
    expect(validateContentInput({ contentType: "post", title: "ok", gameId: "nope" }).ok).toBe(false);
  });
});

describe("followVerdict", () => {
  it("returns ok only for an existing, distinct, un-followed target", () => {
    expect(followVerdict(true, false, false)).toBe("ok");
    expect<FollowVerdict>(followVerdict(false, false, false)).toBe("not_found");
    expect<FollowVerdict>(followVerdict(true, true, false)).toBe("self");
    expect<FollowVerdict>(followVerdict(true, false, true)).toBe("duplicate");
  });
});

describe("creators authorization contract (RLS regression)", () => {
  it("creator_profiles / creator_content are public-read", () => {
    expect(CREATORS_POLICIES).toMatch(/SELECT USING \(true\)/);
  });

  it("creator_profiles writes are self-scoped", () => {
    expect(CREATORS_POLICIES).toMatch(/INSERT WITH CHECK \(auth\.uid\(\) = user_id\)/i);
    expect(CREATORS_POLICIES).toMatch(/UPDATE USING \(auth\.uid\(\) = user_id\)/i);
  });

  it("creator_content writes are self-scoped via creator_id", () => {
    expect(CREATORS_POLICIES).toMatch(/INSERT WITH CHECK \(auth\.uid\(\) = creator_id\)/i);
    expect(CREATORS_POLICIES).toMatch(/UPDATE USING \(auth\.uid\(\) = creator_id\)/i);
  });

  it("creator_followers are self-scoped inserts/deletes", () => {
    expect(CREATORS_POLICIES).toMatch(/INSERT WITH CHECK \(auth\.uid\(\) = user_id\)/i);
    expect(CREATORS_POLICIES).toMatch(/DELETE USING \(auth\.uid\(\) = user_id\)/i);
  });

  it("creator_content has no DELETE policy — the service path is required", () => {
    // Removed via service (admin client + ownership re-check); a plain
    // authenticated client cannot delete creator content under RLS 019.
    const deletePolicies = CREATORS_POLICIES.match(/creator_content/g) ?? [];
    expect(deletePolicies.length).toBeGreaterThanOrEqual(3);
    expect(CREATORS_POLICIES).not.toMatch(/on public\.creator_content FOR DELETE/i);
  });
});