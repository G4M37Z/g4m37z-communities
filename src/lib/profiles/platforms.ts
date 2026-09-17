// ============================================================================
// src/lib/profiles/platforms.ts
// Pure platform metadata + validators for manual, self-reported links.
// NO server imports — safe to import from Client Components and tests.
// ============================================================================

export const PLATFORMS = [
  "steam",
  "playstation",
  "xbox",
  "google_play",
  "apple_game_center",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  steam: "Steam",
  playstation: "PlayStation Network",
  xbox: "Xbox",
  google_play: "Google Play Games",
  apple_game_center: "Apple Game Center",
};

export interface PlatformLink {
  id: string;
  user_id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformLinkInput {
  platform: string;
  handle: string;
  profile_url?: string | null;
}

const HANDLE_RE = /^[a-zA-Z0-9_.\- ]+$/;

export function cleanPlatform(raw: unknown): Platform | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return (PLATFORMS as readonly string[]).includes(s) ? (s as Platform) : null;
}

export function cleanHandle(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 64 || !HANDLE_RE.test(s)) return null;
  return s;
}

export function cleanUrl(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (s.length > 300 || !/^https:\/\/[^\s]+$/.test(s)) return null;
  return s;
}
