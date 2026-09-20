// Deterministic tests for the official game-cover allowlist (GAP-GAMES-01).
// Guards against rendering arbitrary / tampered cover URLs.

import { describe, it, expect } from "vitest";
import { isOfficialCoverUrl } from "@/lib/games/cover-url";

describe("isOfficialCoverUrl", () => {
  it("accepts https Steam CDN cover URLs", () => {
    expect(
      isOfficialCoverUrl("https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg"),
    ).toBe(true);
  });

  it("accepts https IGDB CDN cover URLs", () => {
    expect(
      isOfficialCoverUrl("https://images.igdb.com/igdb/image/upload/t_cover_big/cocxbi.jpg"),
    ).toBe(true);
  });

  it("rejects null and non-URLs", () => {
    expect(isOfficialCoverUrl(null)).toBe(false);
    expect(isOfficialCoverUrl(undefined)).toBe(false);
    expect(isOfficialCoverUrl("not a url")).toBe(false);
  });

  it("rejects non-https and foreign hosts", () => {
    expect(isOfficialCoverUrl("http://cdn.cloudflare.steamstatic.com/x.jpg")).toBe(false);
    expect(isOfficialCoverUrl("https://evil.example.com/x.jpg")).toBe(false);
    expect(isOfficialCoverUrl("https://cdn.supabase.co/x.jpg")).toBe(false);
    expect(isOfficialCoverUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects lookalike hosts", () => {
    expect(isOfficialCoverUrl("https://cdn.cloudflare.steamstatic.com.evil.io/x.jpg")).toBe(false);
    expect(isOfficialCoverUrl("https://images.igdb.com.evil.io/x.jpg")).toBe(false);
  });
});