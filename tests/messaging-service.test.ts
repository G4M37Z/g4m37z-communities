// Deterministic tests for the V3.8 Messaging service.
//
// Covers pure message/verdict helpers and the RLS authorization contract
// sourced from the committed migration (020), including the append-only
// guarantee. DB-layer paths (thread creation, member joins) run at
// integration time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __test, messageBodyVerdict, createDirectVerdict, attachmentVerdict, type CreateDirectVerdict } from "@/lib/messaging/service";

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

describe("attachmentVerdict (GAP-MSG-RICH-02)", () => {
  it("accepts a known catalog sticker URL", () => {
    expect(attachmentVerdict({ url: "/stickers/fire.svg", type: "sticker" }).ok).toBe(true);
  });

  it("rejects an arbitrary URL posing as a sticker", () => {
    const verdict = attachmentVerdict({ url: "https://evil.example/x.svg", type: "sticker" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toBe("Unknown sticker.");
  });

  it("rejects an unknown sticker id under /stickers/", () => {
    expect(attachmentVerdict({ url: "/stickers/not-a-sticker.svg", type: "sticker" }).ok).toBe(false);
  });

  it("rejects a path-traversal sticker reference", () => {
    expect(attachmentVerdict({ url: "/stickers/../secret.svg", type: "sticker" }).ok).toBe(false);
  });

  it("accepts a Tenor-hosted GIF", () => {
    expect(
      attachmentVerdict({ url: "https://media.tenor.com/abc123/xxx.gif", type: "gif" }).ok,
    ).toBe(true);
  });

  it("accepts a GIF uploaded to the first-party bucket", () => {
    expect(
      attachmentVerdict({
        url: "https://zpirpbivhkscixbokpbt.supabase.co/storage/v1/object/public/message-attachments/uid/x.gif",
        type: "gif",
      }).ok,
    ).toBe(true);
  });

  it("rejects an arbitrary hotlinked GIF", () => {
    const verdict = attachmentVerdict({ url: "https://evil.example/anim.gif", type: "gif" });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toBe("Unsupported GIF source.");
  });

  it("rejects a Tenor lookalike host", () => {
    expect(
      attachmentVerdict({ url: "https://media.tenor.com.evil.example/x.gif", type: "gif" }).ok,
    ).toBe(false);
  });

  it("rejects a non-https Tenor URL", () => {
    expect(attachmentVerdict({ url: "http://media.tenor.com/x.gif", type: "gif" }).ok).toBe(false);
  });

  it("does not gate image attachments (validated on the upload path)", () => {
    expect(attachmentVerdict({ url: "https://cdn.example/pic.png", type: "image" }).ok).toBe(true);
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

describe("thread pagination contract (2026-09-29 stale-thread defect)", () => {
  it("listMessages fetches the NEWEST window first, then reverses for display", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/messaging/service.ts"),
      "utf8",
    );
    // The defect: order ascending + range(0,19) returned the OLDEST 20 rows,
    // so threads longer than one page hid new messages in-thread while the
    // conversation-list preview (a separate newest-first query) showed them.
    expect(src).toMatch(
      /listMessages[\s\S]*?\.order\("created_at", \{ ascending: false \}\)/,
    );
    expect(src).toMatch(/listMessages[\s\S]*?\.range\(from, to\)/);
    expect(src).toMatch(/\.reverse\(\)/);
  });

  it("history pages are keyset-based, never offset-shifted", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/messaging/service.ts"),
      "utf8",
    );
    const olderFn = src.slice(
      src.indexOf("export async function listMessagesBefore"),
      src.indexOf("// ---", src.indexOf("export async function listMessagesBefore")),
    );
    // A keyset cursor survives concurrent inserts; an offset window drifts and
    // repeats/skips rows at the page boundary while history is being read.
    expect(olderFn).toMatch(/created_at\.lt\./);
    expect(olderFn).toMatch(/order\("created_at", \{ ascending: false \}\)/);
    expect(olderFn).toMatch(/\.reverse\(\)/);
    expect(olderFn).not.toMatch(/\.range\(/);
  });

  it("stale-comment guard: no ascending listMessages may return", () => {
    // If this fails, someone reintroduced ascending pagination into the
    // message list — re-check the thread page against this contract before
    // changing the assertion.
    const src = readFileSync(
      join(process.cwd(), "src/lib/messaging/service.ts"),
      "utf8",
    );
    const listFn = src.slice(
      src.indexOf("export async function listMessages"),
      src.indexOf("// ---------------------------------------------------------------------------\n// Mutations"),
    );
    expect(listFn).not.toMatch(/ascending: true/);
  });
});

describe("olderCursorVerdict (history paging cursor validation)", () => {
  const id = "26bdebc3-1522-488f-9edb-0ccf6507843a";

  it("accepts a well-formed ISO instant + UUID", () => {
    expect(
      __test.olderCursorVerdict({ created_at: "2026-09-29T11:04:28.933827+00:00", id }),
    ).toEqual({ ok: true, cursor: { created_at: "2026-09-29T11:04:28.933827+00:00", id } });
    expect(__test.olderCursorVerdict({ created_at: "2026-09-29T11:04:28Z", id }).ok).toBe(true);
  });

  it("rejects non-timestamp and non-UUID cursors", () => {
    expect(__test.olderCursorVerdict(null).ok).toBe(false);
    expect(__test.olderCursorVerdict({}).ok).toBe(false);
    expect(__test.olderCursorVerdict({ created_at: "yesterday", id }).ok).toBe(false);
    expect(
      __test.olderCursorVerdict({ created_at: "2026-09-29 11:04:28+00", id }).ok,
    ).toBe(false);
    expect(
      __test.olderCursorVerdict({ created_at: "2026-09-29T11:04:28Z", id: "not-a-uuid" }).ok,
    ).toBe(false);
  });

  it("refuses PostgREST filter injection through the cursor", () => {
    // The cursor is interpolated into `.or(...)`, so filter syntax must never
    // reach the query string.
    const injections = [
      '2026-09-29T11:04:28Z,id.gt.00000000-0000-0000-0000-000000000000',
      '2026-09-29T11:04:28Z"',
      "2026-09-29T11:04:28Z)",
      "2026-09-29T11:04:28Z or true",
    ];
    for (const created_at of injections) {
      expect(__test.olderCursorVerdict({ created_at, id }).ok).toBe(false);
    }
    expect(
      __test.olderCursorVerdict({ created_at: "2026-09-29T11:04:28Z", id: `${id},id.gt.x` }).ok,
    ).toBe(false);
  });

  it("pages in fixed-size windows", () => {
    expect(__test.MESSAGE_PAGE_SIZE).toBe(20);
  });
});