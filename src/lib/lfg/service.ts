// ============================================================================
// src/lib/lfg/service.ts
// V3 Phase 1 / V3.4 — LFG (Looking For Group) service.
//
// Security model (Phase 3 refactor, migration 054):
//   - Every query runs as the caller through the shared server client;
//     the 016 RLS policies are the authorization boundary (public SELECT
//     for non-private sessions, INSERT forced to auth.uid() as host,
//     host-only UPDATE/DELETE, join/leave as self).
//   - Join is the one race-sensitive operation (last slot), so it goes
//     through the atomic lfg_join RPC (054) which re-checks status,
//     capacity, and host-lock inside the transaction and auto-transitions
//     the session to FULL when the last slot is taken.
//   - The (session_id, user_id) PRIMARY KEY prevents duplicate joins.
//   - host_id / user_id are forced server-side; clients never pass IDs.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUERY_LEN = 64;
const MAX_PAGE = 50;
const MAX_TITLE_LEN = 120;
const SESSION_STATUSES = [
  "CREATED",
  "OPEN",
  "FULL",
  "CLOSED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
] as const;
type SessionStatus = (typeof SESSION_STATUSES)[number];
type Privacy = "public" | "private";

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LfgSession {
  id: string;
  game_id: string | null;
  host_id: string | null;
  platform_id: string | null;
  mode: string | null;
  region: string | null;
  skill_level: string | null;
  players_required: number;
  microphone_required: boolean;
  language: string | null;
  session_time: string | null;
  status: SessionStatus;
  privacy: Privacy;
  created_at: string;
  updated_at: string;
}

export interface LfgSessionWithJoins extends LfgSession {
  game_name?: string | null;
  game_slug?: string | null;
  platform_name?: string | null;
  host_username?: string | null;
  host_display_name?: string | null;
  participant_count?: number;
}

export interface LfgParticipant {
  session_id: string;
  user_id: string;
  joined_at: string;
}

export interface LfgParticipantWithProfile extends LfgParticipant {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface CreateLfgInput {
  gameId?: string | null;
  platformId?: string | null;
  mode?: string | null;
  region?: string | null;
  skillLevel?: string | null;
  playersRequired: number;
  microphoneRequired?: boolean;
  language?: string | null;
  sessionTime?: string | null;
  privacy?: Privacy;
}

export interface UpdateLfgInput {
  mode?: string | null;
  region?: string | null;
  skillLevel?: string | null;
  playersRequired?: number;
  microphoneRequired?: boolean;
  language?: string | null;
  sessionTime?: string | null;
  privacy?: Privacy;
  status?: SessionStatus;
}

export interface LfgResult {
  ok: boolean;
  status:
    | "inserted"
    | "duplicate"
    | "full"
    | "unavailable"
    | "forbidden"
    | "not_found"
    | "deleted"
    | "closed"
    | "updated"
    | "error";
  error?: string;
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<string | null> {
  // The service-role client has no user session; identity must come from the
  // cookie-bound server client. Mutations still execute via the admin client.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Reads (public via RLS)
// ---------------------------------------------------------------------------

export async function listLfgSessions(
  supabase: SupabaseClient,
  options: {
    gameId?: string;
    platformId?: string;
    status?: SessionStatus | SessionStatus[];
    search?: string;
    limit?: number;
  } = {},
): Promise<LfgSessionWithJoins[]> {
  let q = supabase
    .from("lfg_sessions")
    .select(
      "id, game_id, host_id, platform_id, mode, region, skill_level, players_required, microphone_required, language, session_time, status, privacy, created_at, updated_at, games:games!lfg_sessions_game_id_fkey ( name, slug ), platforms:platforms!lfg_sessions_platform_id_fkey ( name ), profiles:profiles!lfg_sessions_host_id_fkey ( username, display_name )",
    { count: "exact" },
    )
    .order("session_time", { ascending: true, nullsFirst: false })
    .limit(clamp(options.limit ?? 24, 1, MAX_PAGE));

  if (options.gameId && isUuid(options.gameId)) {
    q = q.eq("game_id", options.gameId);
  }
  if (options.platformId && isUuid(options.platformId)) {
    q = q.eq("platform_id", options.platformId);
  }
  if (options.status) {
    if (Array.isArray(options.status)) {
      q = q.in("status", options.status);
    } else {
      q = q.eq("status", options.status);
    }
  }
  const term = (options.search ?? "").trim().toLowerCase().slice(0, MAX_QUERY_LEN);
  if (term.length > 0) {
    const escaped = term.replace(/\\/g, "\\\\");
    q = q.or(`mode.ilike.%${escaped}%,region.ilike.%${escaped}%,skill_level.ilike.%${escaped}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  const rows = data as Array<
    LfgSession & {
      games: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
      platforms: { name: string } | Array<{ name: string }> | null;
      profiles: { username: string; display_name: string | null } | Array<{ username: string; display_name: string | null }> | null;
    }
  >;

  // Participant count is fetched separately (RLS restricts participant reads
  // to host/self, so we cannot SELECT count(*) directly here). We compute a
  // best-effort count only for sessions the caller can see participants of;
  // for public-discovery listings, we return 0 and let the detail page
  // show the precise count (which the caller also may not see — privacy).
  return rows.map((row) => {
    const game = Array.isArray(row.games) ? row.games[0] : row.games;
    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    const host = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      ...row,
      game_name: game?.name ?? null,
      game_slug: game?.slug ?? null,
      platform_name: platform?.name ?? null,
      host_username: host?.username ?? null,
      host_display_name: host?.display_name ?? null,
      participant_count: 0,
    };
  });
}

export async function getLfgSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LfgSessionWithJoins | null> {
  if (!isUuid(sessionId)) return null;
  const { data, error } = await supabase
    .from("lfg_sessions")
    .select(
      "id, game_id, host_id, platform_id, mode, region, skill_level, players_required, microphone_required, language, session_time, status, privacy, created_at, updated_at, games:games!lfg_sessions_game_id_fkey ( name, slug ), platforms:platforms!lfg_sessions_platform_id_fkey ( name ), profiles:profiles!lfg_sessions_host_id_fkey ( username, display_name )",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as LfgSession & {
    games: { name: string; slug: string } | Array<{ name: string; slug: string }> | null;
    platforms: { name: string } | Array<{ name: string }> | null;
    profiles: { username: string; display_name: string | null } | Array<{ username: string; display_name: string | null }> | null;
  };
  const game = Array.isArray(row.games) ? row.games[0] : row.games;
  const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
  const host = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    ...row,
    game_name: game?.name ?? null,
    game_slug: game?.slug ?? null,
    platform_name: platform?.name ?? null,
    host_username: host?.username ?? null,
    host_display_name: host?.display_name ?? null,
    participant_count: 0,
  };
}

export async function getLfgParticipantCount(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<number> {
  if (!isUuid(sessionId)) return 0;
  // RLS lets a viewer count only their own rows (plus everything if they
  // are the host), so a direct count is wrong for everyone else. The 054
  // RPC returns the true count — for public sessions to any authenticated
  // viewer, otherwise host-or-self only (enforced inside the RPC).
  const { data, error } = await supabase.rpc("lfg_participant_count", {
    p_session_id: sessionId,
  });
  if (error || typeof data !== "number") {
    // Fallback: caller-scoped count (exact for the host; 0 elsewhere).
    const { count } = await supabase
      .from("lfg_participants")
      .select("session_id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    return typeof count === "number" ? count : 0;
  }
  return data;
}

export async function listLfgParticipants(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LfgParticipantWithProfile[]> {
  if (!isUuid(sessionId)) return [];
  const { data, error } = await supabase
    .from("lfg_participants")
    .select(
      "session_id, user_id, joined_at, profiles:profiles!lfg_participants_user_id_fkey ( username, display_name, avatar_url )",
    )
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<
    LfgParticipant & {
      profiles:
        | { username: string; display_name: string | null; avatar_url: string | null }
        | Array<{ username: string; display_name: string | null; avatar_url: string | null }>
        | null;
    }
  >).map((row) => {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      ...row,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
    };
  });
}

export async function getMyParticipation(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string | null,
): Promise<LfgParticipant | null> {
  if (!userId || !isUuid(sessionId)) return null;
  const { data, error } = await supabase
    .from("lfg_participants")
    .select("session_id, user_id, joined_at")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as LfgParticipant;
}

// ---------------------------------------------------------------------------
// Mutations (caller-scoped; RLS 016 + RPC 054 authorize)
// ---------------------------------------------------------------------------

export async function createLfgSession(
  input: CreateLfgInput,
): Promise<LfgResult> {
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };
  if (!Number.isInteger(input.playersRequired) || input.playersRequired < 1 || input.playersRequired > 100) {
    return { ok: false, status: "error", error: "Invalid playersRequired (1..100)" };
  }
  if (input.gameId && !isUuid(input.gameId)) return { ok: false, status: "error", error: "Invalid gameId" };
  if (input.platformId && !isUuid(input.platformId)) return { ok: false, status: "error", error: "Invalid platformId" };

  const supabase = await createClient();
  const payload = {
    host_id: userId,
    game_id: input.gameId ?? null,
    platform_id: input.platformId ?? null,
    mode: input.mode ?? null,
    region: input.region ?? null,
    skill_level: input.skillLevel ?? null,
    players_required: input.playersRequired,
    microphone_required: input.microphoneRequired ?? false,
    language: input.language ?? null,
    session_time: input.sessionTime ?? null,
    status: "CREATED" as SessionStatus,
    privacy: (input.privacy ?? "public") as Privacy,
  };

  // RLS WITH CHECK (auth.uid() = host_id) rejects forging another host.
  const { data, error } = await supabase
    .from("lfg_sessions")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: "error", error: error?.message ?? "Insert failed" };
  return { ok: true, status: "inserted", sessionId: (data as { id: string }).id };
}

export async function updateLfgSession(
  sessionId: string,
  input: UpdateLfgInput,
): Promise<LfgResult> {
  if (!isUuid(sessionId)) return { ok: false, status: "error", error: "Invalid sessionId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const supabase = await createClient();

  // Pre-check keeps the friendlier "not_found"/"forbidden" statuses
  // instead of a bare RLS 0-row update; the UPDATE itself is still gated
  // by the host-only RLS policy.
  const { data: existing, error: rerr } = await supabase
    .from("lfg_sessions")
    .select("host_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (rerr) return { ok: false, status: "error", error: rerr.message };
  if (!existing) return { ok: false, status: "not_found", error: "Session not found" };
  if ((existing as { host_id: string }).host_id !== userId) {
    return { ok: false, status: "forbidden", error: "Only the host can update this session" };
  }

  const update: Record<string, unknown> = {};
  if (input.mode !== undefined) update.mode = input.mode ?? null;
  if (input.region !== undefined) update.region = input.region ?? null;
  if (input.skillLevel !== undefined) update.skill_level = input.skillLevel ?? null;
  if (input.playersRequired !== undefined) {
    if (!Number.isInteger(input.playersRequired) || input.playersRequired < 1 || input.playersRequired > 100) {
      return { ok: false, status: "error", error: "Invalid playersRequired (1..100)" };
    }
    update.players_required = input.playersRequired;
  }
  if (input.microphoneRequired !== undefined) update.microphone_required = input.microphoneRequired;
  if (input.language !== undefined) update.language = input.language ?? null;
  if (input.sessionTime !== undefined) update.session_time = input.sessionTime ?? null;
  if (input.privacy !== undefined) update.privacy = input.privacy;
  if (input.status !== undefined) {
    if (!SESSION_STATUSES.includes(input.status)) {
      return { ok: false, status: "error", error: "Invalid status" };
    }
    update.status = input.status;
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, status: "updated", sessionId };
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("lfg_sessions").update(update).eq("id", sessionId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", sessionId };
}

export async function closeLfgSession(
  sessionId: string,
): Promise<LfgResult> {
  return updateLfgSession(sessionId, { status: "CLOSED" });
}

export async function cancelLfgSession(
  sessionId: string,
): Promise<LfgResult> {
  return updateLfgSession(sessionId, { status: "CANCELLED" });
}

export async function deleteLfgSession(
  sessionId: string,
): Promise<LfgResult> {
  if (!isUuid(sessionId)) return { ok: false, status: "error", error: "Invalid sessionId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const supabase = await createClient();
  const { data: existing, error: rerr } = await supabase
    .from("lfg_sessions")
    .select("host_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (rerr) return { ok: false, status: "error", error: rerr.message };
  if (!existing) return { ok: false, status: "not_found", error: "Session not found" };
  if ((existing as { host_id: string }).host_id !== userId) {
    return { ok: false, status: "forbidden", error: "Only the host can delete this session" };
  }
  const { error } = await supabase.from("lfg_sessions").delete().eq("id", sessionId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "deleted", sessionId };
}

export type JoinVerdict = "unavailable" | "full" | "forbidden" | "joinable";

/**
 * Pure gate for joining an LFG session. Encapsulates the documented
 * lifecycle + capacity + self-join rules so they are unit-testable without
 * a live DB. Returns the intended LfgResult status.
 */
export function joinVerdict(input: {
  status: SessionStatus;
  playersRequired: number;
  hostId: string | null;
  userId: string;
  currentCount: number;
}): JoinVerdict {
  const { status, playersRequired, hostId, userId, currentCount } = input;
  if (
    status === "CLOSED" ||
    status === "CANCELLED" ||
    status === "COMPLETED" ||
    status === "EXPIRED"
  ) {
    return "unavailable";
  }
  if (status === "FULL") return "full";
  if (hostId === userId) return "forbidden";
  if (currentCount >= playersRequired) return "full";
  return "joinable";
}

export async function joinLfgSession(
  sessionId: string,
): Promise<LfgResult> {
  if (!isUuid(sessionId)) return { ok: false, status: "error", error: "Invalid sessionId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  // Atomic join via the 054 RPC: status/capacity/host-lock re-checked
  // inside the transaction, last slot auto-transitions the session to
  // FULL. RLS-hidden participant counts are no longer a problem — the
  // RPC is SECURITY DEFINER with authenticated-only execute.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lfg_join", {
    p_session_id: sessionId,
  });
  if (error) {
    // not_authenticated raises; everything else comes back as a verdict.
    if (error.message.includes("not_authenticated")) {
      return { ok: false, status: "error", error: "Not authenticated" };
    }
    return { ok: false, status: "error", error: error.message };
  }
  const verdict = (data as string) ?? "error";
  if (verdict === "joined") return { ok: true, status: "inserted", sessionId };
  if (verdict === "duplicate") return { ok: true, status: "duplicate", sessionId };
  if (verdict === "full") return { ok: false, status: "full", error: "Session is full" };
  if (verdict === "forbidden") {
    return { ok: false, status: "forbidden", error: "Hosts cannot join their own session" };
  }
  if (verdict === "not_found") return { ok: false, status: "not_found", error: "Session not found" };
  return { ok: false, status: "unavailable", error: `Session is ${verdict}` };
}

export async function leaveLfgSession(
  sessionId: string,
): Promise<LfgResult> {
  if (!isUuid(sessionId)) return { ok: false, status: "error", error: "Invalid sessionId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lfg_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (error) return { ok: false, status: "error", error: error.message };

  // Lifecycle completion for the 054 auto-FULL transition: a FULL session
  // that loses a member reopens. Host-only RLS protects the UPDATE; only
  // the two state columns move.
  const { data: target } = await supabase
    .from("lfg_sessions")
    .select("status, players_required")
    .eq("id", sessionId)
    .maybeSingle();
  const t = target as { status: SessionStatus; players_required: number } | null;
  if (t?.status === "FULL") {
    const { data: remaining } = await supabase.rpc("lfg_participant_count", {
      p_session_id: sessionId,
    });
    if (typeof remaining === "number" && remaining < t.players_required) {
      await supabase
        .from("lfg_sessions")
        .update({ status: "OPEN", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("status", "FULL");
    }
  }
  return { ok: true, status: "deleted", sessionId };
}

export const SESSION_STATUS_VALUES = SESSION_STATUSES;
export const __test = {
  isUuid,
  clamp,
  UUID_RE,
  MAX_QUERY_LEN,
  MAX_PAGE,
  MAX_TITLE_LEN,
  joinVerdict,
};
