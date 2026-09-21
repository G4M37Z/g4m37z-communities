// ============================================================================
// src/lib/gaming/service.ts
// Phase 1 — server-side reads/writes for the gaming identity layer
// (user_games + game_platform_identities, migration 052).
//
// Thin and RLS-scoped: every query runs as the caller through the shared
// server client, so the 052 visibility policies are the authorization
// boundary. Write helpers re-check ownership in code first so failures are
// explicit errors, not silent zero-row updates.
// No service role, no credentials, no external verification claims —
// identity rows are self-reported (mirrors 042 platform_links).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type {
  GameStatus,
  GamePlatformIdentity,
  GameIdentityInput,
  UserGame,
  GamingVisibility,
} from "./types";
import { GAME_STATUSES } from "./types";

// ---------------------------------------------------------------------------
// Pure validators (exported for tests via __gaming)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function cleanStatus(raw: unknown): GameStatus | null {
  const s = String(raw ?? "").trim();
  return (GAME_STATUSES as readonly string[]).includes(s) ? (s as GameStatus) : null;
}

const NOTE_MAX = 280;

export function cleanNote(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return s.length > NOTE_MAX ? null : s;
}

const IN_GAME_NAME_RE = /^[a-zA-Z0-9_.\- ]+$/;

export function cleanInGameName(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (s.length < 1 || s.length > 64) return null;
  return IN_GAME_NAME_RE.test(s) ? s : null;
}

export function cleanRankLabel(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return s.length <= 64 ? s : null;
}

const REGION_RE = /^[A-Za-z0-9][A-Za-z0-9 /-]{0,15}$/;

export function cleanRegion(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;
  return REGION_RE.test(s) ? s : null;
}

export function cleanVisibility(raw: unknown): GamingVisibility | null {
  const s = String(raw ?? "").trim();
  if (s === "public" || s === "followers" || s === "private") return s;
  return null;
}

function cleanGameId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return isUuid(s) ? s : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const GAME_JOIN = "game:games!user_games_game_id_fkey ( id, name, slug, cover_url )";

export interface ListLibraryOptions {
  statuses?: GameStatus[];
  limit?: number;
}

/** One user's library. Visibility is enforced by the 052 SELECT policy. */
export async function listUserGames(
  userId: string,
  options: ListLibraryOptions = {},
): Promise<UserGame[]> {
  if (!isUuid(userId)) return [];
  const supabase = await createClient();
  let query = supabase
    .from("user_games")
    .select(`id, user_id, game_id, status, note, started_at, completed_at, created_at, updated_at, ${GAME_JOIN}`)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 200));
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as UserGame[];
}

const IDENTITY_JOIN =
  "game:games!game_platform_identities_game_id_fkey ( id, name, slug, cover_url )";

/** One user's per-game identities. Visibility enforced by the 052 SELECT policy. */
export async function listGameIdentities(
  userId: string,
): Promise<GamePlatformIdentity[]> {
  if (!isUuid(userId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_platform_identities")
    .select(
      `id, user_id, game_id, platform_slug, in_game_name, rank_label, region, created_at, updated_at, ${IDENTITY_JOIN}`,
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as GamePlatformIdentity[];
}

/** Owner's effective visibility (self reads always pass RLS). */
export async function getGamingVisibility(
  userId: string,
): Promise<GamingVisibility> {
  if (!isUuid(userId)) return "private";
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("gaming_visibility")
    .eq("id", userId)
    .maybeSingle();
  const v = (data as { gaming_visibility?: string } | null)?.gaming_visibility;
  return cleanVisibility(v) ?? "public";
}

export async function setGamingVisibility(
  visibility: GamingVisibility,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = cleanVisibility(visibility);
  if (!v) return { ok: false, error: "Invalid visibility" };
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };
  const { error } = await supabase
    .from("profiles")
    .update({ gaming_visibility: v })
    .eq("id", u.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Writes — library
// ---------------------------------------------------------------------------

export async function addGameStatus(
  input: { game_id: unknown; status: unknown; note?: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };

  const gameId = cleanGameId(input?.game_id);
  if (!gameId) return { ok: false, error: "Unknown game" };
  const status = cleanStatus(input?.status);
  if (!status) return { ok: false, error: "Invalid status" };
  const note = cleanNote(input?.note);
  if (input?.note != null && String(input.note).trim().length > 0 && note === null) {
    return { ok: false, error: "Note too long (max 280)" };
  }

  // The game must exist in the catalogue — explicit 404-style error instead
  // of a foreign-key surprise.
  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { ok: false, error: "Unknown game" };

  const { error } = await supabase.from("user_games").upsert(
    { user_id: u.user.id, game_id: gameId, status, note, updated_at: new Date().toISOString() },
    { onConflict: "user_id,game_id,status" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeGameStatus(
  input: { game_id: unknown; status: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };

  const gameId = cleanGameId(input?.game_id);
  const status = cleanStatus(input?.status);
  if (!gameId || !status) return { ok: false, error: "Invalid request" };

  const { error } = await supabase
    .from("user_games")
    .delete()
    .eq("user_id", u.user.id)
    .eq("game_id", gameId)
    .eq("status", status);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Writes — per-game identity
// ---------------------------------------------------------------------------

export async function saveGameIdentity(
  input: GameIdentityInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };

  const gameId = cleanGameId(input?.game_id);
  if (!gameId) return { ok: false, error: "Unknown game" };
  const name = cleanInGameName(input?.in_game_name);
  if (!name) {
    return { ok: false, error: "In-game name must be 1-64 safe characters" };
  }
  const rank = cleanRankLabel(input?.rank_label);
  if (input?.rank_label != null && String(input.rank_label).trim().length > 0 && rank === null) {
    return { ok: false, error: "Rank label too long (max 64)" };
  }
  const region = cleanRegion(input?.region);
  if (input?.region != null && String(input.region).trim().length > 0 && region === null) {
    return { ok: false, error: "Invalid region" };
  }

  // Platform slug is optional and only linked when it exists in the
  // catalogue (FK would otherwise reject an unknown slug).
  const rawPlatform = input?.platform_slug == null ? null : String(input.platform_slug).trim();
  let platformSlug: string | null = null;
  if (rawPlatform) {
    const { data: p } = await supabase
      .from("platforms")
      .select("slug")
      .eq("slug", rawPlatform)
      .maybeSingle();
    if (!p) return { ok: false, error: "Unknown platform" };
    platformSlug = rawPlatform;
  }

  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return { ok: false, error: "Unknown game" };

  const { error } = await supabase.from("game_platform_identities").upsert(
    {
      user_id: u.user.id,
      game_id: gameId,
      platform_slug: platformSlug,
      in_game_name: name,
      rank_label: rank,
      region,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,game_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteGameIdentity(
  input: { game_id: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };
  const gameId = cleanGameId(input?.game_id);
  if (!gameId) return { ok: false, error: "Invalid request" };
  const { error } = await supabase
    .from("game_platform_identities")
    .delete()
    .eq("user_id", u.user.id)
    .eq("game_id", gameId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Test surface for the pure validators (project convention: __-prefixed).
export const __gaming = {
  cleanStatus,
  cleanNote,
  cleanInGameName,
  cleanRankLabel,
  cleanRegion,
  cleanVisibility,
  GAME_STATUSES,
};
