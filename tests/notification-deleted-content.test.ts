// Regression tests for GAP-01 / GAP-04: deleted-post notifications.
//
// Product contract added in this milestone:
//   1. Migration 035 removes notifications whose reference_id points at
//      deleted posts/comments (one-time purge + BEFORE DELETE triggers).
//   2. The cleanup is database-enforced and SECURITY DEFINER (no app user
//      has DELETE on notifications; the deleting user must not need it).
//   3. getNotificationHref never builds a /post/{id} or /events/{id} URL
//      from a stale reference — stale targets render as plain text.
//   4. Valid references still produce the same hrefs as before.
//
// Server components can't be imported into node tests, so the page module is
// covered by static contract inspection plus behavioral extraction of the
// real getNotificationHref source and evaluation against live sets (the
// established repo pattern, cf. community-media-delete.test.ts and
// p0-security-regression.test.ts).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(process.cwd(), "src/app/notifications/page.tsx"),
  "utf8",
);
const MIGRATION_035 = readFileSync(
  join(
    process.cwd(),
    "docs/database/035_notification_deleted_content_cleanup.sql",
  ),
  "utf8",
);

// ---------------------------------------------------------------------------
// Behavioral extraction: eval the real getNotificationHref implementation in
// isolation so the contract is tested against the shipped code, not a copy.
// ---------------------------------------------------------------------------
type Notif = {
  type: string;
  reference_id: string | null;
  actor?: unknown;
};

function loadHrefFn() {
  const src = PAGE;
  const start = src.indexOf("function getNotificationHref");
  expect(start).toBeGreaterThan(-1);
  // Capture the full function (balanced braces, starting at the signature).
  let depth = 0;
  let end = start;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const fnSrc = src.slice(start, end);
  // The function references the page's Notif type only via its param type —
  // strip types so plain JS can eval it.
  const js = fnSrc
    .replace("notification: NotificationWithActor", "notification")
    .replace("commentTargets: Map<string, string>", "commentTargets")
    .replace("validPostIds: Set<string>", "validPostIds")
    .replace("validEventIds: Set<string>", "validEventIds")
    .replace("): string | null {", ") {");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("return " + js)() as (
    n: Notif,
    commentTargets: Map<string, string>,
    validPostIds: Set<string>,
    validEventIds: Set<string>,
  ) => string | null;
}

const getNotificationHref = loadHrefFn();
const noTargets = new Map<string, string>();
const noPosts = new Set<string>();
const noEvents = new Set<string>();

describe("migration 035 — stale notification cleanup (GAP-01/GAP-04)", () => {
  it("adds BEFORE DELETE cleanup triggers on posts and comments", () => {
    expect(MIGRATION_035).toMatch(
      /CREATE TRIGGER trg_cleanup_notifications_post\s+BEFORE DELETE ON public\.posts/,
    );
    expect(MIGRATION_035).toMatch(
      /CREATE TRIGGER trg_cleanup_notifications_comment\s+BEFORE DELETE ON public\.comments/,
    );
  });

  it("cleanup function runs as SECURITY DEFINER with pinned search_path", () => {
    // Required: no app user has DELETE on notifications (owner-SELECT/UPDATE
    // only), so the trigger must run with elevated privileges, matching the
    // 027 notify_* pattern.
    const fnBlock = MIGRATION_035.slice(
      MIGRATION_035.indexOf("cleanup_notifications_for_deleted_content"),
    );
    expect(fnBlock).toMatch(/SECURITY DEFINER/);
    expect(fnBlock).toMatch(/SET search_path = public/);
  });

  it("cleanup function deletes notifications by reference_id only", () => {
    // Scoped: the cleanup cannot be steered at arbitrary notification rows —
    // it deletes exactly the rows whose reference_id equals the deleted id.
    expect(MIGRATION_035).toMatch(
      /DELETE FROM public\.notifications\s+WHERE reference_id = OLD\.id;/,
    );
  });

  it("purges pre-existing orphans (one-time DELETE with double NOT EXISTS)", () => {
    expect(MIGRATION_035).toMatch(
      /DELETE FROM public\.notifications n\s+WHERE n\.reference_id IS NOT NULL[\s\S]*?NOT EXISTS \(SELECT 1 FROM public\.posts p\s+WHERE p\.id = n\.reference_id\)[\s\S]*?NOT EXISTS \(SELECT 1 FROM public\.comments c WHERE c\.id = n\.reference_id\)/,
    );
  });

  it("is idempotent (IF EXISTS / OR REPLACE everywhere)", () => {
    expect(MIGRATION_035).toMatch(/CREATE OR REPLACE FUNCTION/);
    expect(MIGRATION_035).toMatch(/DROP TRIGGER IF EXISTS/);
  });
});

describe("getNotificationHref — stale references cannot produce broken URLs", () => {
  it("post_vote for an existing post still returns /post/{id}", () => {
    const posts = new Set(["p1"]);
    expect(
      getNotificationHref(
        { type: "post_vote", reference_id: "p1" },
        noTargets,
        posts,
        noEvents,
      ),
    ).toBe("/post/p1");
  });

  it("post_vote for a deleted post returns null (plain text, no 404 link)", () => {
    expect(
      getNotificationHref(
        { type: "post_vote", reference_id: "deleted-post" },
        noTargets,
        noPosts,
        noEvents,
      ),
    ).toBeNull();
  });

  it("event_rsvp for a deleted event returns null", () => {
    expect(
      getNotificationHref(
        { type: "event_rsvp", reference_id: "gone-event" },
        noTargets,
        noPosts,
        noEvents,
      ),
    ).toBeNull();
  });

  it("comment-family references unchanged: comment id -> /post/{post_id}", () => {
    const targets = new Map([["c1", "p1"]]);
    expect(
      getNotificationHref(
        { type: "comment_on_post", reference_id: "c1" },
        targets,
        noPosts,
        noEvents,
      ),
    ).toBe("/post/p1");
    expect(
      getNotificationHref(
        { type: "reply_to_comment", reference_id: "c1" },
        targets,
        noPosts,
        noEvents,
      ),
    ).toBe("/post/p1");
    expect(
      getNotificationHref(
        { type: "comment_vote", reference_id: "c1" },
        targets,
        noPosts,
        noEvents,
      ),
    ).toBe("/post/p1");
  });

  it("comment-family references for deleted comments still return null", () => {
    expect(
      getNotificationHref(
        { type: "comment_on_post", reference_id: "deleted-comment" },
        noTargets,
        noPosts,
        noEvents,
      ),
    ).toBeNull();
  });

  it("mention references unchanged: comment id -> /post/{post_id}, else null", () => {
    const targets = new Map([["c1", "p1"]]);
    expect(
      getNotificationHref(
        { type: "mention", reference_id: "c1" },
        targets,
        noPosts,
        noEvents,
      ),
    ).toBe("/post/p1");
    expect(
      getNotificationHref(
        { type: "mention", reference_id: "missing" },
        noTargets,
        noPosts,
        noEvents,
      ),
    ).toBeNull();
  });

  it("null reference_id still returns null for every type", () => {
    for (const type of [
      "post_vote",
      "comment_on_post",
      "reply_to_comment",
      "comment_vote",
      "event_rsvp",
      "mention",
      "report_resolved",
      "moderation_action",
      "community_invite",
      "repost",
      "follow",
    ]) {
      expect(
        getNotificationHref(
          { type, reference_id: null },
          noTargets,
          noPosts,
          noEvents,
        ),
      ).toBeNull();
    }
  });
});

describe("notifications page — existence-guard wiring", () => {
  it("page fetches existing post ids for post_vote references", () => {
    expect(PAGE).toMatch(/\.filter\(\(n\) => n\.type === "post_vote"\)/);
    expect(PAGE).toMatch(/\.from\("posts"\)\s*\n?\s*\.select\("id"\)/);
  });

  it("page fetches existing event ids for event_rsvp references", () => {
    expect(PAGE).toMatch(/\.filter\(\(n\) => n\.type === "event_rsvp"\)/);
    expect(PAGE).toMatch(/\.from\("events"\)\s*\n?\s*\.select\("id"\)/);
  });

  it("page passes the validity sets into getNotificationHref", () => {
    expect(PAGE).toMatch(
      /getNotificationHref\(\s*notification,\s*commentTargets,\s*validPostIds,\s*validEventIds,?\s*\)/,
    );
  });

  it("no direct unguarded /post/${reference_id} interpolation remains", () => {
    // Exactly three /post/ templates may exist:
    //   1. the guarded reference_id one (validity-checked before use);
    //   2. the comment-family one via a postId local (existence-guaranteed
    //      by the commentTargets lookup);
    //   3. the mention one via commentTargets.get (same guarantee).
    const unguarded = [
      ...PAGE.matchAll(/`\/post\/\$\{[^}]+\}`/g),
    ].map((m) => m[0]);
    expect(unguarded.filter((t) => t === "`/post/${reference_id}`").length).toBe(1);
    expect(unguarded.filter((t) => t === "`/post/${postId}`").length).toBe(1);
    expect(
      unguarded.filter((t) => t === "`/post/${commentTargets.get(reference_id)}`")
        .length,
    ).toBe(1);
    expect(unguarded.length).toBe(3);
  });
});
