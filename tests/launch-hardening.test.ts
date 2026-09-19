// Launch-hardening regression tests.
//
// Verifies the security/correctness contract introduced by migration
// 045_launch_hardening.sql and its accompanying client changes:
//   - posts INSERT requires active community membership (RLS)
//   - webrtc_signals INSERT requires room participation
//   - reposts are uniquely keyed, so the service's 23505 idempotency holds
//   - join_community/leave_community never mutate the role column
//   - create_direct_conversation refuses blocked pairs (P0002, no leak)
//   - voice-recordings storage is owner-only
// plus the pure client-side guards: image magic-byte sniffing, image path
// ownership, terms-version validation and the env-gated rate limiter.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { __postImageTest } from "@/lib/posts/image-validation-test";
import { validateTerms } from "@/lib/terms";
import { rateLimit } from "@/lib/rate-limit";

const MIGRATION = readFileSync(
  join(process.cwd(), "docs/database/045_launch_hardening.sql"),
  "utf8",
);

const { sniffImageType, postImagePathFromUrl, validateOwnedImageUrl } = __postImageTest;

function fileFromBytes(bytes: number[], mime: string, name = "x.bin"): File {
  return new File([new Uint8Array(bytes)], name, { type: mime });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sniffImageType (magic bytes)", () => {
  it("recognises real JPEG bytes", async () => {
    const file = fileFromBytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "image/jpeg", "a.jpg");
    expect(await sniffImageType(file)).toBe("image/jpeg");
  });

  it("recognises real PNG bytes", async () => {
    const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    expect(await sniffImageType(fileFromBytes(bytes, "image/png"))).toBe("image/png");
  });

  it("rejects non-image content even when the MIME claims an image", async () => {
    const html = fileFromBytes(
      [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45], // "<!DOCTYPE"
      "image/jpeg",
      "evil.jpg",
    );
    expect(await sniffImageType(html)).toBeNull();
  });

  it("rejects empty files", async () => {
    expect(await sniffImageType(fileFromBytes([], "image/png"))).toBeNull();
  });
});

describe("postImagePathFromUrl / validateOwnedImageUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzcompany.supabase.co");
  });

  it("extracts a path under the post-images bucket", () => {
    const url = "https://xyzcompany.supabase.co/storage/v1/object/public/post-images/uuid/img.webp";
    expect(postImagePathFromUrl(url)).toBe("uuid/img.webp");
  });

  it("accepts only the owner's own object", () => {
    expect(validateOwnedImageUrl(
      "https://xyzcompany.supabase.co/storage/v1/object/public/post-images/uuid/img.webp",
      "uuid",
    )).toBeNull();
    expect(validateOwnedImageUrl(
      "https://xyzcompany.supabase.co/storage/v1/object/public/post-images/other/img.webp",
      "uuid",
    )).toMatch(/isn't one of your uploads/);
  });

  it("rejects non-storage or foreign-host URLs", () => {
    expect(postImagePathFromUrl("https://example.com/evil.png")).toBeNull();
    expect(postImagePathFromUrl("https://other.supabase.co/storage/v1/object/public/post-images/uuid/a.png")).toBeNull();
    expect(postImagePathFromUrl("not a url")).toBeNull();
  });
});

describe("validateTerms", () => {
  it("accepts the current version with acceptance flagged", () => {
    expect(validateTerms("true", "v1")).toBeNull();
  });

  it("rejects a missing acceptance", () => {
    expect(validateTerms(null, "v1")).toMatch(/must accept the Terms/i);
    expect(validateTerms("false", "v1")).toMatch(/must accept the Terms/i);
  });

  it("rejects a forged/unknown version", () => {
    expect(validateTerms("true", "v0")).toMatch(/updated/);
    expect(validateTerms("true", "")).toMatch(/updated/);
  });
});

describe("rateLimit (env-gated)", () => {
  it("fails open when KV env vars are absent", async () => {
    const r = await rateLimit("k", 5, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(5);
  });

  it("fails open when the KV endpoint errors", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    const r = await rateLimit("k", 5, 60);
    expect(r.allowed).toBe(true);
  });
});

describe("migration 045 contract", () => {
  it("adds the reposts unique key the service depends on for 23505 idempotency", () => {
    expect(MIGRATION).toMatch(/reposts_reposter_post_key UNIQUE \(reposter_id, post_id\)/);
  });

  it("gates posts INSERT on active community membership", () => {
    const policy = /CREATE POLICY "Authenticated users can create posts"[\s\S]*?cm\.left_at IS NULL/;
    expect(MIGRATION).toMatch(policy);
  });

  it("gates webrtc_signals INSERT on room participation", () => {
    expect(MIGRATION).toMatch(/voice_room_participants vrp/);
    expect(MIGRATION).toMatch(/vrp\.room_id = webrtc_signals\.room_id/);
  });

  it("re-keys voice-room participant INSERT to an active member of the room's community", () => {
    expect(MIGRATION).toMatch(/CREATE POLICY "Self can insert" ON public\.voice_room_participants/);
    expect(MIGRATION).toMatch(/vr\.is_active[\s\S]*?cm\.user_id = auth\.uid\(\)/);
  });

  it("preserves roles on rejoin — join/leave RPCs never touch the role column", () => {
    expect(MIGRATION).toMatch(/DO UPDATE SET joined_at = now\(\), left_at = NULL/);
    expect(MIGRATION).toMatch(/SET left_at = now\(\)/);
  });

  it("makes voice recordings owner-only readable", () => {
    expect(MIGRATION).toMatch(/Anyone can read voice recordings[\s\S]*?foldername\(name\)\)\[1\] = \(auth\.uid\(\)\)::text/);
  });

  it("refuses direct conversations with blocked users without leaking state", () => {
    expect(MIGRATION).toMatch(/blocker_id = uid AND blocked_id = p_other/);
    expect(MIGRATION).toMatch(/blocker_id = p_other AND blocked_id = uid/);
    const blockBranch = MIGRATION.slice(MIGRATION.indexOf("A blocked pair"));
    expect(blockBranch).toMatch(/errcode = 'P0002'/);
  });
});