// Deterministic tests for the V3.8 Messaging service.
//
// Covers pure message/verdict helpers and the RLS authorization contract
// sourced from the committed migration (020), including the append-only
// guarantee. DB-layer paths (thread creation, member joins) run at
// integration time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __test, messageBodyVerdict, createDirectVerdict, type CreateDirectVerdict } from "@/lib/messaging/service";

const { isUuid, clamp, MAX_BODY, MAX_PAGE } = __test;

const MESSAGING_POLICIES = readFileSync(
  join(process.cwd(), "docs/database/020_messaging_policies.sql"),
  "utf8",
);

describe("messaging UUID / bounds (pure helpers)", () => {
  it("isUuid() accepts canonical UUIDs and rejects malformed values", () => {
    expect(isUuid("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isUuid("not-uuid")).toBe(false);
  });

  it("clamp() bounds page sizes and the body cap is 4000", () => {
    expect(clamp(5, 1, MAX_PAGE)).toBe(5);
    expect(clamp(500, 1, MAX_PAGE)).toBe(MAX_PAGE);
    expect(MAX_BODY).toBe(4000);
  });
});

describe("messageBodyVerdict", () => {
  it("normalises a valid body", () => {
    const verdict = messageBodyVerdict("  hey  ");
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.body).toBe("hey");
  });

  it("rejects empty bodies", () => {
    expect(messageBodyVerdict("   ").ok).toBe(false);
    expect(messageBodyVerdict("").ok).toBe(false);
  });

  it("rejects bodies over the 4000-char cap", () => {
    expect(messageBodyVerdict("x".repeat(MAX_BODY + 1)).ok).toBe(false);
  });

  it("accepts a body exactly at the cap", () => {
    expect(messageBodyVerdict("x".repeat(MAX_BODY)).ok).toBe(true);
  });
});

describe("createDirectVerdict", () => {
  it("rejects messaging yourself", () => {
    expect<CreateDirectVerdict>(
      createDirectVerdict({ senderId: "a", recipientId: "a", recipientExists: true, existingThreadId: null }),
    ).toBe("self");
  });

  it("rejects a missing recipient", () => {
    expect<CreateDirectVerdict>(
      createDirectVerdict({ senderId: "a", recipientId: "b", recipientExists: false, existingThreadId: null }),
    ).toBe("not_found");
  });

  it("reuses an existing direct thread", () => {
    expect<CreateDirectVerdict>(
      createDirectVerdict({ senderId: "a", recipientId: "b", recipientExists: true, existingThreadId: "t-1" }),
    ).toBe("reuse");
  });

  it("allows creating a new direct thread", () => {
    expect<CreateDirectVerdict>(
      createDirectVerdict({ senderId: "a", recipientId: "b", recipientExists: true, existingThreadId: null }),
    ).toBe("ok");
  });
});

describe("messaging authorization contract (RLS regression)", () => {
  it("messages are append-only (UPDATE and DELETE denied)", () => {
    expect(MESSAGING_POLICIES).toMatch(/CREATE POLICY messages_update[\s\S]*USING \(false\)/);
    expect(MESSAGING_POLICIES).toMatch(/CREATE POLICY messages_delete[\s\S]*USING \(false\)/);
  });

  it("sender_id is server-resolved to auth.uid() on INSERT", () => {
    expect(MESSAGING_POLICIES).toMatch(/auth\.uid\(\) = messages\.sender_id/i);
  });

  it("message SELECT is member-scoped", () => {
    expect(MESSAGING_POLICIES).toMatch(/messages_select/i);
    expect(MESSAGING_POLICIES).toMatch(/conversation_members\.user_id = auth\.uid\(\)/i);
  });

  it("conversation_members have no UPDATE policy — read receipts are write-only", () => {
    // No UPDATE policy exists for conversation_members, and messages are
    // append-only, so acknowledging a message currently requires a schema
    // change. The service does not attempt it.
    expect(MESSAGING_POLICIES).not.toMatch(/conversation_members_update/i);
  });
});