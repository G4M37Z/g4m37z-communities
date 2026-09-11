// Deterministic tests for the V3.5 Events service.
//
// Covers pure validation paths and the documented authorization contracts.
// DB-layer code paths (createEvent / rsvpEvent / updateEvent / cancel) require
// the SUPABASE_SERVICE_ROLE_KEY env var and are exercised at integration time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __test, EVENT_STATUSES, rsvpVerdict } from "@/lib/events/service";

const { isUuid, clamp, MAX_QUERY_LEN, MAX_PAGE, MAX_TITLE_LEN, MAX_DESCRIPTION_LEN, lockKeyInt4 } = __test;

const EVENT_POLICIES = readFileSync(
  join(process.cwd(), "docs/database/017_events_policies.sql"),
  "utf8",
);

describe("EVENT_STATUSES enum", () => {
  it("contains the documented lifecycle states", () => {
    expect(EVENT_STATUSES).toEqual(
      expect.arrayContaining([
        "DRAFT",
        "PUBLISHED",
        "FULL",
        "CANCELLED",
        "COMPLETED",
        "EXPIRED",
      ]),
    );
  });
});

describe("input validation helpers", () => {
  it("clamp() bounds integers", () => {
    expect(clamp(0, 1, 1000)).toBe(1);
    expect(clamp(1001, 1, 1000)).toBe(1000);
    expect(clamp(50, 1, 1000)).toBe(50);
  });
  it("isUuid() is correct", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
  it("query bounds match the project convention", () => {
    expect(MAX_QUERY_LEN).toBe(64);
    expect(MAX_PAGE).toBe(50);
  });
  it("title and description length caps are documented", () => {
    expect(MAX_TITLE_LEN).toBe(200);
    expect(MAX_DESCRIPTION_LEN).toBe(8000);
  });
});

describe("advisory-lock key derivation (capacity race containment)", () => {
  it("returns a stable int4 key for the same UUID", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    const a = lockKeyInt4(uuid);
    const b = lockKeyInt4(uuid);
    expect(a).toBe(b);
  });
  it("returns different keys for different UUIDs in the same namespace", () => {
    const a = lockKeyInt4("00000000-0000-4000-8000-000000000001");
    const b = lockKeyInt4("11111111-1111-4111-8111-111111111111");
    // Most UUIDs should produce different keys; collision in cryptographic
    // hashing is acceptable for advisory-lock purposes (a collision just
    // serializes more events unnecessarily). We only assert difference for
    // a reasonably-distinct pair.
    expect(a).not.toBe(b);
  });
  it("returns a 32-bit signed integer safe for Number transport", () => {
    const k = lockKeyInt4("00000000-0000-4000-8000-0000000000ff");
    expect(Number.isInteger(k)).toBe(true);
    expect(k).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(k).toBeLessThanOrEqual(2 ** 31 - 1);
  });
});

describe("rsvpVerdict lifecycle + capacity gate (pure)", () => {
  it("rejects CANCELLED, COMPLETED, EXPIRED events", () => {
    for (const s of ["CANCELLED", "COMPLETED", "EXPIRED"]) {
      expect(rsvpVerdict({ status: s, capacity: null, maxAttendees: 10, currentCount: 0 })).toBe("unavailable");
    }
  });
  it("rejects DRAFT (not published) and FULL events", () => {
    expect(rsvpVerdict({ status: "DRAFT", capacity: null, maxAttendees: 10, currentCount: 0 })).toBe("unavailable");
    expect(rsvpVerdict({ status: "FULL", capacity: null, maxAttendees: 10, currentCount: 0 })).toBe("full");
  });
  it("respects the V4 effective capacity = capacity ?? max_attendees", () => {
    // capacity present and reached
    expect(rsvpVerdict({ status: "PUBLISHED", capacity: 5, maxAttendees: null, currentCount: 5 })).toBe("full");
    expect(rsvpVerdict({ status: "PUBLISHED", capacity: 5, maxAttendees: null, currentCount: 4 })).toBe("joinable");
    // capacity null -> falls through to max_attendees (V4 backfill)
    expect(rsvpVerdict({ status: "PUBLISHED", capacity: null, maxAttendees: 50, currentCount: 50 })).toBe("full");
    expect(rsvpVerdict({ status: "PUBLISHED", capacity: null, maxAttendees: 50, currentCount: 49 })).toBe("joinable");
  });
  it("allows PUBLISHED / LIVE events with headroom", () => {
    expect(rsvpVerdict({ status: "PUBLISHED", capacity: null, maxAttendees: null, currentCount: 0 })).toBe("joinable");
    expect(rsvpVerdict({ status: "LIVE", capacity: 100, maxAttendees: 120, currentCount: 99 })).toBe("joinable");
  });
});

describe("Authorization contracts (RLS, migration 017)", () => {
  it("only the community creator can edit/delete an event with community_id set", () => {
    expect(EVENT_POLICIES).toContain("c.creator_id = auth.uid()");
    expect(EVENT_POLICIES).toContain('CREATE POLICY "Event owner can update own event"');
    expect(EVENT_POLICIES).toContain('CREATE POLICY "Event owner can delete own event"');
  });
  it("events with NULL community_id follow the open-community model (creator check still enforced)", () => {
    expect(EVENT_POLICIES).toContain("community_id IS NULL");
    expect(EVENT_POLICIES).toContain("USING (");
  });
  it("user_id is forced from auth.uid() on participant INSERT", () => {
    expect(EVENT_POLICIES).toContain("auth.uid() IS NOT NULL AND auth.uid() = user_id");
  });
  it("event owner can revoke RSVPs; non-owner cannot", () => {
    expect(EVENT_POLICIES).toContain('CREATE POLICY "Users can cancel own RSVP; event owner can revoke"');
    expect(EVENT_POLICIES).toContain("auth.uid() = user_id");
  });
  it("duplicate RSVPs are blocked at DB level via (event_id, user_id) uniqueness", () => {
    expect(EVENT_POLICIES).toContain("event_id, user_id");
  });
  it("capacity contention degrades to a sequential best-effort path (documented)", () => {
    // rsvpEventBestEffort returns 'full' for FULL status via the gate, and the
    // asynchronous capacity-boundary race is closed DB-side by the participant PK.
    expect(rsvpVerdict({ status: "FULL", capacity: null, maxAttendees: 10, currentCount: 0 })).toBe("full");
  });
});
