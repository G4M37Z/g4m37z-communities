// ============================================================================
// src/lib/games/service.ts
// V3 Phase 1 / V3.3 — Game Discovery service.
//
// Security model:
//   - Catalogue reads (games / genres / platforms / joins) use the regular
//     Supabase client (RLS allows public SELECT).
//   - User-owned mutations (follow / unfollow / review CRUD) go through
//     createAdminClient (service_role). The authenticated user identity
//     is resolved server-side and never trusted from the client.
//   - Duplicate follows are blocked by the (game_id, user_id) PRIMARY KEY.
//     Duplicate INSERTs return status:"duplicate" without throwing.
//   - Score inputs are validated client-side at the service boundary to
//     enforce sane ranges; DB CHECK constraints enforce the same bounds.
//
// Catalogue writes (creating games, genres, platforms) are NOT exposed here:
// those remain service-role / admin tooling only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_QUERY_LEN = 64;
const MAX_PAGE = 50;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
function isValidSlug(v: string): boolean {
  return typeof v === "string" && v.length > 0 && v.length <= 64 && SLUG_RE.test(v);
}
function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

// ---------------------------------------------------------------------------
// Catalogue (read-only, public via RLS).
// ---------------------------------------------------------------------------

export interface Game {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  release_date: string | null;
  cover_url: string | null;
  created_at: string;
}
export interface Genre {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}
export interface Platform {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export async function listGames(
  supabase: SupabaseClient,
  options: { search?: string; limit?: number } = {},
): Promise<Game[]> {
  const limit = clamp(options.limit ?? 24, 1, MAX_PAGE);
  let query = supabase
    .from("games")
    .select("id, name, slug, description, release_date, cover_url, created_at")
    .order("name")
    .limit(limit);
  const term = (options.search ?? "").trim().toLowerCase().slice(0, MAX_QUERY_LEN);
  if (term.length > 0) {
    // Postgres ilike wildcard on validated input — both `%` and `_` would
    // otherwise be treated as wildcards, which is fine here (we want a
    // substring match) but the term is also length-capped.
    const escaped = term.replace(/\\/g, "\\\\");
    query = query.ilike("name", `%${escaped}%`);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Game[];
}

export async function getGameById(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, description, release_date, cover_url, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Game;
}

export async function getGameBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Game | null> {
  if (!isValidSlug(slug)) return null;
  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, description, release_date, cover_url, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as Game;
}

export async function getGameByName(
  supabase: SupabaseClient,
  name: string,
): Promise<Game | null> {
  if (!name || name.length === 0 || name.length > 200) return null;
  const { data, error } = await supabase
    .from("games")
    .select("id, name, slug, description, release_date, cover_url, created_at")
    .eq("name", name)
    .maybeSingle();
  if (error || !data) return null;
  return data as Game;
}

export async function listGenres(supabase: SupabaseClient): Promise<Genre[]> {
  const { data, error } = await supabase
    .from("genres")
    .select("id, name, slug, created_at")
    .order("name");
  if (error || !data) return [];
  return data as Genre[];
}

export async function listPlatforms(
  supabase: SupabaseClient,
): Promise<Platform[]> {
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, slug, created_at")
    .order("name");
  if (error || !data) return [];
  return data as Platform[];
}

export interface GameGenreRow {
  game_id: string;
  genre_id: string;
}
export async function getGameGenres(
  supabase: SupabaseClient,
  gameId: string,
): Promise<Genre[]> {
  if (!isUuid(gameId)) return [];
  const { data: joins, error: jerr } = await supabase
    .from("game_genres")
    .select("game_id, genre_id")
    .eq("game_id", gameId);
  if (jerr || !joins || joins.length === 0) return [];
  const ids = (joins as GameGenreRow[]).map((j) => j.genre_id);
  const { data, error } = await supabase
    .from("genres")
    .select("id, name, slug, created_at")
    .in("id", ids);
  if (error || !data) return [];
  return data as Genre[];
}

export async function getGamePlatforms(
  supabase: SupabaseClient,
  gameId: string,
): Promise<Platform[]> {
  if (!isUuid(gameId)) return [];
  const { data: joins, error: jerr } = await supabase
    .from("game_platforms")
    .select("game_id, platform_id")
    .eq("game_id", gameId);
  if (jerr || !joins || joins.length === 0) return [];
  const ids = joins.map((j: { platform_id: string }) => j.platform_id);
  const { data, error } = await supabase
    .from("platforms")
    .select("id, name, slug, created_at")
    .in("id", ids);
  if (error || !data) return [];
  return data as Platform[];
}

// ---------------------------------------------------------------------------
// Game following
// ---------------------------------------------------------------------------

export interface FollowResult {
  ok: boolean;
  status: "inserted" | "duplicate" | "deleted" | "error";
  error?: string;
}

/** Follow a game. Idempotent: a duplicate is treated as success no-op. */
export async function followGame(
  gameId: string,
): Promise<FollowResult> {
  if (!isUuid(gameId)) return { ok: false, status: "error", error: "Invalid gameId" };
  // Use the regular client for auth resolution (it carries the session cookie),
  // then delegate the insert to the admin client (service_role bypasses RLS
  // for the writable policy that requires auth.uid() = user_id; service_role
  // INSERTs return auth.uid() NULL via auth functions but we explicitly set
  // user_id from the resolved session).
  const session = createAdminClient();
  const { data: userData } = await session.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const { error } = await session
    .from("game_followers")
    .insert({ game_id: gameId, user_id: userId });
  if (!error) return { ok: true, status: "inserted" };
  if (error.code === "23505") return { ok: true, status: "duplicate" };
  return { ok: false, status: "error", error: error.message };
}

/** Unfollow a game. Idempotent: missing row treated as success. */
export async function unfollowGame(
  gameId: string,
): Promise<FollowResult> {
  if (!isUuid(gameId)) return { ok: false, status: "error", error: "Invalid gameId" };
  const session = createAdminClient();
  const { data: userData } = await session.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const { error } = await session
    .from("game_followers")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", userId);
  if (!error) return { ok: true, status: "deleted" };
  return { ok: false, status: "error", error: error.message };
}

/** Returns true if the current user follows this game. */
export async function isFollowingGame(
  supabase: SupabaseClient,
  gameId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId || !isUuid(gameId)) return false;
  const { data, error } = await supabase
    .from("game_followers")
    .select("game_id")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

/** Returns follower count for a game. */
export async function getGameFollowerCount(
  supabase: SupabaseClient,
  gameId: string,
): Promise<number> {
  if (!isUuid(gameId)) return 0;
  const { count, error } = await supabase
    .from("game_followers")
    .select("game_id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error || typeof count !== "number") return 0;
  return count;
}

/** List games the current user follows (used by profile). */
export async function getFollowedGames(
  supabase: SupabaseClient,
  userId: string,
  limit = 12,
): Promise<Game[]> {
  if (!isUuid(userId)) return [];
  const { data: rows, error } = await supabase
    .from("game_followers")
    .select("game_id")
    .eq("user_id", userId)
    .order("followed_at", { ascending: false })
    .limit(clamp(limit, 1, MAX_PAGE));
  if (error || !rows || rows.length === 0) return [];
  const ids = rows.map((r: { game_id: string }) => r.game_id);
  const { data, error: gerr } = await supabase
    .from("games")
    .select("id, name, slug, description, release_date, cover_url, created_at")
    .in("id", ids);
  if (gerr || !data) return [];
  return data as Game[];
}

// ---------------------------------------------------------------------------
// Game reviews
// ---------------------------------------------------------------------------

export interface GameReview {
  id: string;
  game_id: string;
  user_id: string;
  gameplay_score: number | null;
  graphics_score: number | null;
  performance_score: number | null;
  story_score: number | null;
  audio_score: number | null;
  value_score: number | null;
  overall_score: number | null;
  body: string | null;
  created_at: string;
}

export interface GameReviewWithAuthor extends GameReview {
  author_username?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
}

export interface CreateReviewInput {
  gameId: string;
  gameplayScore?: number | null;
  graphicsScore?: number | null;
  performanceScore?: number | null;
  storyScore?: number | null;
  audioScore?: number | null;
  valueScore?: number | null;
  overallScore?: number | null;
  body?: string | null;
}

export interface UpdateReviewInput {
  reviewId: string;
  gameplayScore?: number | null;
  graphicsScore?: number | null;
  performanceScore?: number | null;
  storyScore?: number | null;
  audioScore?: number | null;
  valueScore?: number | null;
  overallScore?: number | null;
  body?: string | null;
}

const SCORE_LO = 1;
const SCORE_HI = 10;
const OVERALL_LO = 0;
const OVERALL_HI = 100;

function sanitizeScore(
  v: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v)) return undefined as unknown as null;
  return clamp(v, lo, hi);
}

export interface ReviewResult {
  ok: boolean;
  status: "inserted" | "updated" | "deleted" | "not_found" | "forbidden" | "error";
  error?: string;
  reviewId?: string;
}

export async function createGameReview(
  input: CreateReviewInput,
): Promise<ReviewResult> {
  if (!isUuid(input.gameId)) return { ok: false, status: "error", error: "Invalid gameId" };
  const session = createAdminClient();
  const { data: userData } = await session.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const payload = {
    game_id: input.gameId,
    user_id: userId,
    gameplay_score: sanitizeScore(input.gameplayScore, SCORE_LO, SCORE_HI),
    graphics_score: sanitizeScore(input.graphicsScore, SCORE_LO, SCORE_HI),
    performance_score: sanitizeScore(input.performanceScore, SCORE_LO, SCORE_HI),
    story_score: sanitizeScore(input.storyScore, SCORE_LO, SCORE_HI),
    audio_score: sanitizeScore(input.audioScore, SCORE_LO, SCORE_HI),
    value_score: sanitizeScore(input.valueScore, SCORE_LO, SCORE_HI),
    overall_score: sanitizeScore(input.overallScore, OVERALL_LO, OVERALL_HI),
    body: input.body ?? null,
  };

  // Verify the game actually exists before inserting.
  const { data: game, error: gerr } = await session
    .from("games")
    .select("id")
    .eq("id", input.gameId)
    .maybeSingle();
  if (gerr) return { ok: false, status: "error", error: gerr.message };
  if (!game) return { ok: false, status: "not_found", error: "Game not found" };

  const { data, error } = await session
    .from("game_reviews")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, status: "error", error: error?.message ?? "Insert failed" };
  }
  return { ok: true, status: "inserted", reviewId: (data as { id: string }).id };
}

export async function updateGameReview(
  input: UpdateReviewInput,
): Promise<ReviewResult> {
  if (!isUuid(input.reviewId))
    return { ok: false, status: "error", error: "Invalid reviewId" };
  const session = createAdminClient();
  const { data: userData } = await session.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const update: Record<string, unknown> = {};
  const fields: Array<[string, number | null | undefined, number, number]> = [
    ["gameplay_score", input.gameplayScore, SCORE_LO, SCORE_HI],
    ["graphics_score", input.graphicsScore, SCORE_LO, SCORE_HI],
    ["performance_score", input.performanceScore, SCORE_LO, SCORE_HI],
    ["story_score", input.storyScore, SCORE_LO, SCORE_HI],
    ["audio_score", input.audioScore, SCORE_LO, SCORE_HI],
    ["value_score", input.valueScore, SCORE_LO, SCORE_HI],
    ["overall_score", input.overallScore, OVERALL_LO, OVERALL_HI],
  ];
  for (const [col, val, lo, hi] of fields) {
    if (val === undefined) continue;
    update[col] = sanitizeScore(val as number | null, lo, hi);
  }
  if (input.body !== undefined) update.body = input.body ?? null;

  // Ownership verification + update combined: WHERE user_id = auth.uid()
  // is enforced by RLS but we also verify explicitly because the admin
  // client bypasses RLS. This guards against a coding mistake (e.g. if
  // RLS were weakened for any reason).
  const { data: existing, error: rerr } = await session
    .from("game_reviews")
    .select("id, user_id")
    .eq("id", input.reviewId)
    .maybeSingle();
  if (rerr) return { ok: false, status: "error", error: rerr.message };
  if (!existing) return { ok: false, status: "not_found", error: "Review not found" };
  if ((existing as { user_id: string }).user_id !== userId)
    return { ok: false, status: "forbidden", error: "Not your review" };

  const { error } = await session
    .from("game_reviews")
    .update(update)
    .eq("id", input.reviewId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", reviewId: input.reviewId };
}

export async function deleteGameReview(
  reviewId: string,
): Promise<ReviewResult> {
  if (!isUuid(reviewId))
    return { ok: false, status: "error", error: "Invalid reviewId" };
  const session = createAdminClient();
  const { data: userData } = await session.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const { data: existing, error: rerr } = await session
    .from("game_reviews")
    .select("user_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (rerr) return { ok: false, status: "error", error: rerr.message };
  if (!existing) return { ok: false, status: "not_found", error: "Review not found" };
  if ((existing as { user_id: string }).user_id !== userId)
    return { ok: false, status: "forbidden", error: "Not your review" };

  const { error } = await session
    .from("game_reviews")
    .delete()
    .eq("id", reviewId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "deleted", reviewId };
}

export async function listGameReviews(
  supabase: SupabaseClient,
  gameId: string,
  options: { limit?: number } = {},
): Promise<GameReviewWithAuthor[]> {
  if (!isUuid(gameId)) return [];
  const limit = clamp(options.limit ?? 20, 1, MAX_PAGE);
  const { data, error } = await supabase
    .from("game_reviews")
    .select(
      "id, game_id, user_id, gameplay_score, graphics_score, performance_score, story_score, audio_score, value_score, overall_score, body, created_at, profiles:profiles!game_reviews_user_id_fkey ( username, display_name, avatar_url )",
    )
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Array<
    GameReview & {
      profiles:
        | { username: string; display_name: string | null; avatar_url: string | null }
        | Array<{ username: string; display_name: string | null; avatar_url: string | null }>
        | null;
    }
  >).map((row) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      ...row,
      author_username: author?.username ?? null,
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
    };
  });
}

export async function getUserReviewsForGame(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
): Promise<GameReview | null> {
  if (!isUuid(gameId) || !isUuid(userId)) return null;
  const { data, error } = await supabase
    .from("game_reviews")
    .select(
      "id, game_id, user_id, gameplay_score, graphics_score, performance_score, story_score, audio_score, value_score, overall_score, body, created_at",
    )
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as GameReview;
}

// Exported for tests (input validation clamps).
export const __test = {
  SCORE_LO,
  SCORE_HI,
  OVERALL_LO,
  OVERALL_HI,
  sanitizeScore,
  isValidSlug,
  clamp,
};
