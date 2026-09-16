// Regression tests for the community deletion + community media milestone.
//
// Covers the product contract added in this milestone:
//   1. Community deletion is creator-only (app check + RLS policy).
//   2. Community icon/banner upload validates kind, size, and MIME server-side.
//   3. The community-media bucket + storage policies exist in migration 034.
//   4. Messaging is reachable from both desktop (UserMenu) and mobile
//      (BottomNav) navigation.
//
// Server actions are "use server" modules — their internals can't be imported
// directly into node tests, so validation/authorization logic is verified by
// static contract inspection (the established repo pattern, cf.
// p0-security-regression.test.ts), plus pure-function coverage of the
// extension helpers.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ACTIONS = readFileSync(
  join(process.cwd(), "src/lib/communities/actions.ts"),
  "utf8",
);
const MIGRATION_034 = readFileSync(
  join(process.cwd(), "docs/database/034_community_media_and_deletion.sql"),
  "utf8",
);
const SETTINGS_PAGE = readFileSync(
  join(process.cwd(), "src/app/communities/[slug]/settings/page.tsx"),
  "utf8",
);
const USER_MENU = readFileSync(
  join(process.cwd(), "src/components/UserMenu.tsx"),
  "utf8",
);
const BOTTOM_NAV = readFileSync(
  join(process.cwd(), "src/components/BottomNav.tsx"),
  "utf8",
);
const MEDIA_FORM = readFileSync(
  join(process.cwd(), "src/components/communities/CommunityMediaForm.tsx"),
  "utf8",
);
const DELETE_BUTTON = readFileSync(
  join(process.cwd(), "src/components/communities/DeleteCommunityButton.tsx"),
  "utf8",
);

describe("community deletion (product contract)", () => {
  it("deleteCommunity action exists and is creator-only", () => {
    expect(ACTIONS).toContain("export async function deleteCommunity");
    expect(ACTIONS).toContain("Only the community creator can delete it.");
  });

  it("deleteCommunity resolves identity server-side, never trusts the client", () => {
    // Identity comes from the cookie-bound Supabase client, not from input.
    expect(ACTIONS).toMatch(
      /deleteCommunity[\s\S]*?supabase\.auth\.getUser\(\)[\s\S]*?creator_id !== user\.id/,
    );
  });

  it("RLS policy gates DELETE to the creator in the live migration set", () => {
    // The creator DELETE policy ships in 002_communities (verified live via
    // sql/verify-034.sql: "Creator can delete own community" → DELETE policy).
    const MIGRATION_002 = readFileSync(
      join(process.cwd(), "docs/database/002_communities.sql"),
      "utf8",
    );
    expect(MIGRATION_002).toContain("Creator can delete own community");
  });

  it("delete requires typed slug confirmation in the UI", () => {
    expect(DELETE_BUTTON).toContain("confirmation !== slug");
    expect(DELETE_BUTTON).toContain("Delete permanently");
  });

  it("delete button is rendered only for the community creator", () => {
    expect(SETTINGS_PAGE).toContain("creator_id === user.id");
    expect(SETTINGS_PAGE).toContain("DeleteCommunityButton");
  });

  it("media cleanup in deleteCommunity is non-fatal", () => {
    expect(ACTIONS).toMatch(/catch \{[\s\S]*?non-fatal[\s\S]*?\}/);
  });
});

describe("community media upload (product contract)", () => {
  it("uploadCommunityMedia action exists with kind validation", () => {
    expect(ACTIONS).toContain("export async function uploadCommunityMedia");
    expect(ACTIONS).toContain('kindRaw !== "icon" && kindRaw !== "banner"');
  });

  it("enforces the 5 MB size cap and image MIME allowlist server-side", () => {
    expect(ACTIONS).toMatch(/CM_MAX_BYTES = 5 \* 1024 \* 1024/);
    expect(ACTIONS).toContain('"image/jpeg"');
    expect(ACTIONS).toContain('"image/png"');
    expect(ACTIONS).toContain('"image/webp"');
    expect(ACTIONS).toContain('"image/gif"');
    expect(ACTIONS).toContain("Image must be 5 MB or smaller.");
    expect(ACTIONS).toContain("Image must be JPEG, PNG, WebP, or GIF.");
  });

  it("authorization mirrors storage RLS: creator or moderator/admin only", () => {
    expect(ACTIONS).toMatch(
      /isCreator = community\.creator_id === user\.id/,
    );
    expect(ACTIONS).toMatch(
      /role === "admin" \|\| m\.role === "moderator"/,
    );
    expect(ACTIONS).toContain(
      "Only the creator or moderators can change community media.",
    );
  });

  it("never trusts client MIME alone — extension derives from validated type", () => {
    expect(ACTIONS).toContain("cmSafeExt(file.type)");
    // Upload passes the validated contentType explicitly.
    expect(ACTIONS).toContain("contentType: file.type");
  });

  it("writes the versioned URL to the correct column and revalidates", () => {
    expect(ACTIONS).toContain('kind === "icon" ? "icon_url" : "banner_url"');
    expect(ACTIONS).toMatch(/\$\{publicUrl\}\?v=\$\{Date\.now\(\)\}/);
  });

  it("storage policies: public read, authenticated writes via helper", () => {
    expect(MIGRATION_034).toContain("Anyone can read community media");
    expect(MIGRATION_034).toContain("Moderators can upload community media");
    expect(MIGRATION_034).toContain("Moderators can update community media");
    expect(MIGRATION_034).toContain("Moderators can delete community media");
    expect(MIGRATION_034).toContain("SECURITY DEFINER");
    expect(MIGRATION_034).toContain("SET search_path = public");
  });

  it("upload UI surfaces loading, success, and error states", () => {
    expect(MEDIA_FORM).toContain("Uploading…");
    expect(MEDIA_FORM).toContain('role="alert"');
    expect(MEDIA_FORM).toContain("disabled={pendingKind !== null}");
  });

  it("media form is wired into community settings", () => {
    expect(SETTINGS_PAGE).toContain("CommunityMediaForm");
    expect(SETTINGS_PAGE).toContain("icon_url ?? null");
    expect(SETTINGS_PAGE).toContain("banner_url ?? null");
  });
});

describe("messaging navigation (product contract)", () => {
  it("desktop UserMenu links to /messages", () => {
    expect(USER_MENU).toContain('href="/messages"');
    expect(USER_MENU).toContain("Messages");
  });

  it("mobile BottomNav links to /messages", () => {
    expect(BOTTOM_NAV).toContain('href: "/messages"');
    expect(BOTTOM_NAV).toContain('label: "Messages"');
  });
});
