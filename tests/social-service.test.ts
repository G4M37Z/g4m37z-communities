// Deterministic tests for the V3.9 Social Graph service.
//
// Covers pure edge verdicts, frozen bounds, and the RLS authorization
// contract sourced from the committed migration (021). DB-layer paths run at
// integration time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __test, edgeVerdict, type EdgeVerdict } from "@/lib/social/service";

const { isUuid, clamp, MAX_PAGE } = __test;

const SOCIAL_POLICIES = readFileSync(
  join(process.cwd(), "docs/database/021_social_graph_policies.sql"),
  "utf8",
);

describe("social UUID / bounds (pure helpers)", () => {
  it("isUuid() accepts canonical UUIDs and rejects malformed values", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("nope")).toBe(false);
  });

  it("clamp() bounds list sizes", () => {
    expect(clamp(0, 1, MAX_PAGE)).toBe(1);
    expect(clamp(200, 1, MAX_PAGE)).toBe(MAX_PAGE);
  });

  it("page size cap is 50", () => {
    expect(MAX_PAGE).toBe(50);
  });
});

describe("edgeVerdict", () => {
  it("rejects self-directed edges", () => {
    expect<EdgeVerdict>(edgeVerdict(true, false)).toBe("self");
  });

  it("rejects duplicates when the edge already exists", () => {
    expect<EdgeVerdict>(edgeVerdict(false, true)).toBe("duplicate");
  });

  it("allows a valid new edge", () => {
    expect<EdgeVerdict>(edgeVerdict(false, false)).toBe("ok");
  });
});

describe("social authorization contract (RLS regression)", () => {
  it("follow / block / mute inserts are scoped to auth.uid()", () => {
    expect(SOCIAL_POLICIES).toMatch(/INSERT WITH CHECK \(follower_id = auth\.uid\(\)\)/i);
    expect(SOCIAL_POLICIES).toMatch(/INSERT WITH CHECK \(blocker_id = auth\.uid\(\)\)/i);
    expect(SOCIAL_POLICIES).toMatch(/INSERT WITH CHECK \(muter_id = auth\.uid\(\)\)/i);
  });

  it("follow / block / mute deletes are scoped to auth.uid()", () => {
    expect(SOCIAL_POLICIES).toMatch(/DELETE USING \(follower_id = auth\.uid\(\)\)/i);
    expect(SOCIAL_POLICIES).toMatch(/DELETE USING \(blocker_id = auth\.uid\(\)\)/i);
    expect(SOCIAL_POLICIES).toMatch(/DELETE USING \(muter_id = auth\.uid\(\)\)/i);
  });

  it("follows SELECT is follower-scoped — the followers feed needs the admin path", () => {
    // A user can only SELECT rows where follower_id = auth.uid(); rows where
    // followed_id = auth.uid() are invisible -> listFollowers() must resolve
    // the caller and read their own followers via the admin client.
    expect(SOCIAL_POLICIES).toMatch(/FOR SELECT USING \(follower_id = auth\.uid\(\)\)/i);
  });

  it("notification_events are user-scoped with UPDATE for read state", () => {
    expect(SOCIAL_POLICIES).toMatch(/FOR SELECT USING \(user_id = auth\.uid\(\)\)/i);
    expect(SOCIAL_POLICIES).toMatch(/FOR UPDATE USING \(user_id = auth\.uid\(\)\)/i);
  });
});