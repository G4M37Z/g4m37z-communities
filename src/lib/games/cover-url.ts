// ============================================================================
// src/lib/games/cover-url.ts
// Official-cover allowlist guard (GAP-GAMES-01). Game cover art is hotlinked
// from official CDNs only — Steam's steamstatic CDN for Steam-hosted titles
// and IGDB's images.igdb.com for everything else (the register's rule: never
// commit game art to the repo). Any other source is rejected at the boundary
// so a tampered or user-supplied cover_url can never be rendered.
// ============================================================================

const OFFICIAL_COVER_HOSTS = new Set([
  "cdn.cloudflare.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "shared.cloudflare.steamstatic.com",
  "images.igdb.com",
]);

export function isOfficialCoverUrl(
  url: string | null | undefined,
): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && OFFICIAL_COVER_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export const __test = { OFFICIAL_COVER_HOSTS };