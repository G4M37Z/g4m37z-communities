// ============================================================================
// src/lib/gaming/types.ts
// Phase 1 — Gaming Identity types. Database-shaped (user_games 052,
// game_platform_identities 052, games catalogue). Pure types + status
// metadata — no server imports, safe in Client Components and tests.
// ============================================================================

export const GAME_STATUSES = [
  "owned",
  "playing",
  "want_to_play",
  "favorite",
  "followed",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  owned: "Owned",
  playing: "Playing",
  want_to_play: "Want to play",
  favorite: "Favorite",
  followed: "Following",
};

/** Order used for rendering the library sections on a gaming profile. */
export const LIBRARY_ORDER: GameStatus[] = [
  "playing",
  "favorite",
  "owned",
  "want_to_play",
  "followed",
];

export const GAMING_VISIBILITIES = ["public", "followers", "private"] as const;

export type GamingVisibility = (typeof GAMING_VISIBILITIES)[number];

export interface UserGame {
  id: string;
  user_id: string;
  game_id: string;
  status: GameStatus;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Joined game catalogue row (lib/list queries attach it). */
  game: {
    id: string;
    name: string;
    slug: string;
    cover_url: string | null;
  } | null;
}

export interface GamePlatformIdentity {
  id: string;
  user_id: string;
  game_id: string;
  platform_slug: string | null;
  in_game_name: string;
  rank_label: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
  /** Joined game catalogue row (lib/list queries attach it). */
  game: {
    id: string;
    name: string;
    slug: string;
    cover_url: string | null;
  } | null;
}

export interface GameIdentityInput {
  game_id: string;
  platform_slug?: string | null;
  in_game_name: string;
  rank_label?: string | null;
  region?: string | null;
}
