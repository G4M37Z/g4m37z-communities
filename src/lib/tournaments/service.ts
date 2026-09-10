// ============================================================================
// src/lib/tournaments/service.ts
// V3 Phase 1 / V3.6 — Tournaments service.
//
// Security model:
//   - Reads use the regular Supabase client (RLS allows public SELECT).
//   - Mutations go through createAdminClient (service_role). Authenticated
//     user identity is resolved server-side; clients never supply user_id.
//   - The tournaments table has NO owner_id column. Ownership is derived
//     via the underlying event: events.community_id → communities.creator_id.
//     Tournaments with event_id IS NULL cannot be edited via this service
//     (open model documented).
//   - The tournament_teams table has captain_id but no membership table.
//     Members beyond the captain are NOT represented in the schema.
//   - Per-schema design, results submission is the ORGANISER's job
//     (tournament_results.verified). Per-team result submission is
//     OUT OF SCOPE per the schema (the captain_id is recorded on the
//     team, not on a separate per-user roster). The service reflects
//     this design: results are managed by the organiser only.
//   - Disputes are raised by any authenticated user; only the organiser
//     resolves them. The raiser may withdraw their own dispute (status
//     transition to WITHDRAWN) but not delete it.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUERY_LEN = 64;
const MAX_PAGE = 50;
const MAX_NAME_LEN = 200;
const MAX_TEAM_NAME_LEN = 64;
const MAX_REASON_LEN = 4000;

export const TOURNAMENT_STATUSES = [
  "REGISTRATION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const MATCH_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const DISPUTE_STATUSES = [
  "PENDING",
  "RESOLVED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const TOURNAMENT_FORMATS = [
  "SINGLE_ELIMINATION",
  "DOUBLE_ELIMINATION",
  "ROUND_ROBIN",
  "SWISS",
] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

async function resolveUserId(): Promise<string | null> {
  const session = createAdminClient();
  const { data } = await session.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Defense-in-depth: verify the current user is the tournament organiser by
 * joining tournaments → events → communities. Returns true on success.
 * Admin client bypasses RLS, so this is the authoritative check.
 */
async function isTournamentOrganiser(
  supabase: SupabaseClient,
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("event_id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error || !data) return false;
  const t = data as { event_id: string | null };
  if (t.event_id === null) return false;
  const { data: ev, error: eerr } = await supabase
    .from("events")
    .select("community_id")
    .eq("id", t.event_id)
    .maybeSingle();
  if (eerr || !ev) return false;
  const e = ev as { community_id: string | null };
  if (e.community_id === null) return false;
  const { data: comm, error: cerr } = await supabase
    .from("communities")
    .select("creator_id")
    .eq("id", e.community_id)
    .maybeSingle();
  if (cerr || !comm) return false;
  return (comm as { creator_id: string }).creator_id === userId;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tournament {
  id: string;
  event_id: string | null;
  game_id: string | null;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  max_teams: number;
  created_at: string;
}

export interface TournamentWithJoins extends Tournament {
  event_title?: string | null;
  game_name?: string | null;
  team_count?: number;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  name: string;
  captain_id: string;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  status: MatchStatus;
  scheduled_time: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TournamentMatchWithJoins extends TournamentMatch {
  team_a_name?: string | null;
  team_b_name?: string | null;
  winner_name?: string | null;
}

export interface TournamentResult {
  match_id: string;
  verified: boolean;
  dispute_id: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export interface TournamentDispute {
  id: string;
  match_id: string;
  raised_by: string;
  reason: string | null;
  status: DisputeStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface CreateTournamentInput {
  eventId?: string | null;
  gameId?: string | null;
  name: string;
  format?: TournamentFormat;
  maxTeams?: number;
}

export interface UpdateTournamentInput {
  name?: string;
  format?: TournamentFormat;
  status?: TournamentStatus;
  maxTeams?: number;
}

export interface RegisterTeamInput {
  tournamentId: string;
  name: string;
}

export interface CreateMatchInput {
  tournamentId: string;
  round: number;
  teamAId?: string | null;
  teamBId?: string | null;
  scheduledTime?: string | null;
}

export interface SubmitResultInput {
  matchId: string;
  winnerId: string;
  verified?: boolean;
}

export interface CreateDisputeInput {
  matchId: string;
  reason: string;
}

export interface ResolveDisputeInput {
  disputeId: string;
  outcome: "RESOLVED" | "REJECTED";
}

export interface OpResult {
  ok: boolean;
  status:
    | "inserted"
    | "updated"
    | "deleted"
    | "forbidden"
    | "not_found"
    | "duplicate"
    | "invalid_input"
    | "closed"
    | "unavailable"
    | "error";
  error?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listTournaments(
  supabase: SupabaseClient,
  options: {
    gameId?: string;
    status?: TournamentStatus | TournamentStatus[];
    search?: string;
    limit?: number;
  } = {},
): Promise<TournamentWithJoins[]> {
  let q = supabase
    .from("tournaments")
    .select(
      "id, event_id, game_id, name, format, status, max_teams, created_at, games:games!tournaments_game_id_fkey ( name ), events:events!tournaments_event_id_fkey ( title )",
    )
    .order("created_at", { ascending: false })
    .limit(clamp(options.limit ?? 24, 1, MAX_PAGE));

  if (options.gameId && isUuid(options.gameId)) {
    q = q.eq("game_id", options.gameId);
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
    q = q.ilike("name", `%${escaped}%`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Array<
    Tournament & {
      games: { name: string } | Array<{ name: string }> | null;
      events: { title: string } | Array<{ title: string }> | null;
    }
  >).map((row) => {
    const g = Array.isArray(row.games) ? row.games[0] : row.games;
    const e = Array.isArray(row.events) ? row.events[0] : row.events;
    return {
      ...row,
      game_name: g?.name ?? null,
      event_title: e?.title ?? null,
      team_count: 0,
    };
  });
}

export async function getTournament(
  supabase: SupabaseClient,
  id: string,
): Promise<TournamentWithJoins | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, event_id, game_id, name, format, status, max_teams, created_at, games:games!tournaments_game_id_fkey ( name ), events:events!tournaments_event_id_fkey ( title )",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Tournament & {
    games: { name: string } | Array<{ name: string }> | null;
    events: { title: string } | Array<{ title: string }> | null;
  };
  const g = Array.isArray(row.games) ? row.games[0] : row.games;
  const e = Array.isArray(row.events) ? row.events[0] : row.events;
  return {
    ...row,
    game_name: g?.name ?? null,
    event_title: e?.title ?? null,
    team_count: 0,
  };
}

export async function getTeamCount(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<number> {
  if (!isUuid(tournamentId)) return 0;
  const { count, error } = await supabase
    .from("tournament_teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  if (error || typeof count !== "number") return 0;
  return count;
}

export async function listTeams(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<TournamentTeam[]> {
  if (!isUuid(tournamentId)) return [];
  const { data, error } = await supabase
    .from("tournament_teams")
    .select("id, tournament_id, name, captain_id, created_at")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as TournamentTeam[];
}

export async function getTeam(
  supabase: SupabaseClient,
  teamId: string,
): Promise<TournamentTeam | null> {
  if (!isUuid(teamId)) return null;
  const { data, error } = await supabase
    .from("tournament_teams")
    .select("id, tournament_id, name, captain_id, created_at")
    .eq("id", teamId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TournamentTeam;
}

export async function listMatches(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<TournamentMatchWithJoins[]> {
  if (!isUuid(tournamentId)) return [];
  const { data, error } = await supabase
    .from("tournament_matches")
    .select(
      "id, tournament_id, round, team_a_id, team_b_id, winner_id, status, scheduled_time, completed_at, created_at, ta:tournament_teams!tournament_matches_team_a_id_fkey ( name ), tb:tournament_teams!tournament_matches_team_b_id_fkey ( name ), w:tournament_teams!tournament_matches_winner_id_fkey ( name )",
    )
    .eq("tournament_id", tournamentId)
    .order("round", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as Array<
    TournamentMatch & {
      ta: { name: string } | Array<{ name: string }> | null;
      tb: { name: string } | Array<{ name: string }> | null;
      w: { name: string } | Array<{ name: string }> | null;
    }
  >).map((row) => {
    const ta = Array.isArray(row.ta) ? row.ta[0] : row.ta;
    const tb = Array.isArray(row.tb) ? row.tb[0] : row.tb;
    const w = Array.isArray(row.w) ? row.w[0] : row.w;
    return {
      ...row,
      team_a_name: ta?.name ?? null,
      team_b_name: tb?.name ?? null,
      winner_name: w?.name ?? null,
    };
  });
}

export async function getResultForMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<TournamentResult | null> {
  if (!isUuid(matchId)) return null;
  const { data, error } = await supabase
    .from("tournament_results")
    .select("match_id, verified, dispute_id, verified_at, verified_by")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TournamentResult;
}

export async function listDisputes(
  supabase: SupabaseClient,
  matchId: string,
): Promise<TournamentDispute[]> {
  if (!isUuid(matchId)) return [];
  const { data, error } = await supabase
    .from("tournament_disputes")
    .select("id, match_id, raised_by, reason, status, resolved_at, resolved_by, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as TournamentDispute[];
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createTournament(
  input: CreateTournamentInput,
): Promise<OpResult> {
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };
  const name = (input.name ?? "").trim().slice(0, MAX_NAME_LEN);
  if (name.length === 0) return { ok: false, status: "invalid_input" };
  if (input.gameId && !isUuid(input.gameId)) return { ok: false, status: "invalid_input" };
  if (input.eventId && !isUuid(input.eventId)) return { ok: false, status: "invalid_input" };

  let maxTeams: number | null = null;
  if (input.maxTeams !== undefined && input.maxTeams !== null) {
    if (
      !Number.isInteger(input.maxTeams) ||
      input.maxTeams < 2 ||
      input.maxTeams > 128
    ) {
      return { ok: false, status: "invalid_input" };
    }
    maxTeams = input.maxTeams;
  }

  const session = createAdminClient();
  const payload = {
    event_id: input.eventId ?? null,
    game_id: input.gameId ?? null,
    name,
    format: (input.format ?? "SINGLE_ELIMINATION") as TournamentFormat,
    status: "REGISTRATION" as TournamentStatus,
    max_teams: maxTeams ?? 8,
  };
  const { data, error } = await session
    .from("tournaments")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: "error", error: error?.message };
  return { ok: true, status: "inserted", id: (data as { id: string }).id };
}

export async function updateTournament(
  tournamentId: string,
  input: UpdateTournamentInput,
): Promise<OpResult> {
  if (!isUuid(tournamentId)) return { ok: false, status: "invalid_input" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };

  const session = createAdminClient();
  const editor = await isTournamentOrganiser(session, tournamentId, userId);
  if (!editor) return { ok: false, status: "forbidden" };

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const t = String(input.name).trim().slice(0, MAX_NAME_LEN);
    if (t.length === 0) return { ok: false, status: "invalid_input" };
    update.name = t;
  }
  if (input.format !== undefined) {
    if (!TOURNAMENT_FORMATS.includes(input.format)) {
      return { ok: false, status: "invalid_input" };
    }
    update.format = input.format;
  }
  if (input.status !== undefined) {
    if (!TOURNAMENT_STATUSES.includes(input.status)) {
      return { ok: false, status: "invalid_input" };
    }
    update.status = input.status;
  }
  if (input.maxTeams !== undefined) {
    if (
      !Number.isInteger(input.maxTeams) ||
      input.maxTeams < 2 ||
      input.maxTeams > 128
    ) {
      return { ok: false, status: "invalid_input" };
    }
    update.max_teams = input.maxTeams;
  }
  if (Object.keys(update).length === 0) return { ok: true, status: "updated", id: tournamentId };

  const { error } = await session
    .from("tournaments")
    .update(update)
    .eq("id", tournamentId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", id: tournamentId };
}

export async function deleteTournament(tournamentId: string): Promise<OpResult> {
  if (!isUuid(tournamentId)) return { ok: false, status: "invalid_input" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };
  const session = createAdminClient();
  const editor = await isTournamentOrganiser(session, tournamentId, userId);
  if (!editor) return { ok: false, status: "forbidden" };
  const { error } = await session.from("tournaments").delete().eq("id", tournamentId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "deleted", id: tournamentId };
}

export async function registerTeam(
  input: RegisterTeamInput,
): Promise<OpResult> {
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };
  if (!isUuid(input.tournamentId)) return { ok: false, status: "invalid_input" };
  const name = (input.name ?? "").trim().slice(0, MAX_TEAM_NAME_LEN);
  if (name.length === 0) return { ok: false, status: "invalid_input" };

  const session = createAdminClient();
  // Lifecycle check.
  const { data: t, error: terr } = await session
    .from("tournaments")
    .select("status, max_teams")
    .eq("id", input.tournamentId)
    .maybeSingle();
  if (terr || !t) return { ok: false, status: "not_found" };
  const tt = t as { status: TournamentStatus; max_teams: number };
  if (tt.status !== "REGISTRATION") return { ok: false, status: "closed" };

  // Capacity check.
  const { count, error: cerr } = await session
    .from("tournament_teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId);
  if (cerr || typeof count !== "number") return { ok: false, status: "error" };
  if (count >= tt.max_teams) return { ok: false, status: "closed" };

  const { data, error } = await session
    .from("tournament_teams")
    .insert({ tournament_id: input.tournamentId, name, captain_id: userId })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, status: "error", error: error?.message };
  }
  return { ok: true, status: "inserted", id: (data as { id: string }).id };
}

export async function withdrawTeam(teamId: string): Promise<OpResult> {
  if (!isUuid(teamId)) return { ok: false, status: "invalid_input" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };

  const session = createAdminClient();
  // Authorisation: captain or organiser.
  const { data: team, error: terr } = await session
    .from("tournament_teams")
    .select("captain_id, tournament_id")
    .eq("id", teamId)
    .maybeSingle();
  if (terr || !team) return { ok: false, status: "not_found" };
  const t = team as { captain_id: string; tournament_id: string };
  const isCaptain = t.captain_id === userId;
  const isOrganiser = await isTournamentOrganiser(session, t.tournament_id, userId);
  if (!isCaptain && !isOrganiser) return { ok: false, status: "forbidden" };

  const { error } = await session.from("tournament_teams").delete().eq("id", teamId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "deleted", id: teamId };
}

export async function createMatch(
  input: CreateMatchInput,
): Promise<OpResult> {
  if (!isUuid(input.tournamentId)) return { ok: false, status: "invalid_input" };
  if (input.teamAId && !isUuid(input.teamAId)) return { ok: false, status: "invalid_input" };
  if (input.teamBId && !isUuid(input.teamBId)) return { ok: false, status: "invalid_input" };
  if (!Number.isInteger(input.round) || input.round < 0) {
    return { ok: false, status: "invalid_input" };
  }
  if (input.teamAId && input.teamBId && input.teamAId === input.teamBId) {
    return { ok: false, status: "invalid_input" };
  }
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };
  const session = createAdminClient();
  const editor = await isTournamentOrganiser(session, input.tournamentId, userId);
  if (!editor) return { ok: false, status: "forbidden" };

  const payload = {
    tournament_id: input.tournamentId,
    round: input.round,
    team_a_id: input.teamAId ?? null,
    team_b_id: input.teamBId ?? null,
    scheduled_time: input.scheduledTime ?? null,
    status: "SCHEDULED" as MatchStatus,
  };
  const { data, error } = await session
    .from("tournament_matches")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: "error", error: error?.message };
  return { ok: true, status: "inserted", id: (data as { id: string }).id };
}

export async function submitResult(
  input: SubmitResultInput,
): Promise<OpResult> {
  if (!isUuid(input.matchId)) return { ok: false, status: "invalid_input" };
  if (!isUuid(input.winnerId)) return { ok: false, status: "invalid_input" };

  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };

  const session = createAdminClient();
  const { data: match, error: merr } = await session
    .from("tournament_matches")
    .select("tournament_id, status, team_a_id, team_b_id")
    .eq("id", input.matchId)
    .maybeSingle();
  if (merr || !match) return { ok: false, status: "not_found" };
  const m = match as { tournament_id: string; status: MatchStatus; team_a_id: string | null; team_b_id: string | null };

  // winner must be one of the two teams in the match
  if (m.team_a_id !== input.winnerId && m.team_b_id !== input.winnerId) {
    return { ok: false, status: "invalid_input" };
  }

  const editor = await isTournamentOrganiser(session, m.tournament_id, userId);
  if (!editor) return { ok: false, status: "forbidden" };

  // Upsert into tournament_results (one row per match via PK).
  const { error } = await session.from("tournament_results").upsert({
    match_id: input.matchId,
    verified: input.verified ?? true,
    verified_at: new Date().toISOString(),
    verified_by: userId,
    dispute_id: null,
  });
  if (error) return { ok: false, status: "error", error: error.message };

  // Update the match's status and winner_id.
  const upd = await session
    .from("tournament_matches")
    .update({
      status: "COMPLETED",
      winner_id: input.winnerId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.matchId);
  if (upd.error) return { ok: false, status: "error", error: upd.error.message };

  return { ok: true, status: "updated", id: input.matchId };
}

export async function createDispute(
  input: CreateDisputeInput,
): Promise<OpResult> {
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };
  if (!isUuid(input.matchId)) return { ok: false, status: "invalid_input" };
  const reason = (input.reason ?? "").trim().slice(0, MAX_REASON_LEN);
  if (reason.length === 0) return { ok: false, status: "invalid_input" };

  const session = createAdminClient();
  const { data, error } = await session
    .from("tournament_disputes")
    .insert({
      match_id: input.matchId,
      raised_by: userId,
      reason,
      status: "PENDING" as DisputeStatus,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: "error", error: error?.message };
  return { ok: true, status: "inserted", id: (data as { id: string }).id };
}

export async function resolveDispute(
  input: ResolveDisputeInput,
): Promise<OpResult> {
  if (!isUuid(input.disputeId)) return { ok: false, status: "invalid_input" };
  if (input.outcome !== "RESOLVED" && input.outcome !== "REJECTED") {
    return { ok: false, status: "invalid_input" };
  }
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };

  const session = createAdminClient();
  const { data: dispute, error: derr } = await session
    .from("tournament_disputes")
    .select("match_id")
    .eq("id", input.disputeId)
    .maybeSingle();
  if (derr || !dispute) return { ok: false, status: "not_found" };
  const d = dispute as { match_id: string };
  const { data: match, error: merr } = await session
    .from("tournament_matches")
    .select("tournament_id")
    .eq("id", d.match_id)
    .maybeSingle();
  if (merr || !match) return { ok: false, status: "not_found" };
  const m = match as { tournament_id: string };
  const editor = await isTournamentOrganiser(session, m.tournament_id, userId);
  if (!editor) return { ok: false, status: "forbidden" };

  const { error } = await session
    .from("tournament_disputes")
    .update({
      status: input.outcome,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.disputeId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", id: input.disputeId };
}

export async function withdrawDispute(disputeId: string): Promise<OpResult> {
  if (!isUuid(disputeId)) return { ok: false, status: "invalid_input" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error" };

  const session = createAdminClient();
  // Raiser may withdraw their own dispute (status → WITHDRAWN). The
  // defence-in-depth check below keeps the service contract clear even
  // though RLS also enforces auth.uid() = raised_by.
  const { data: dispute, error: derr } = await session
    .from("tournament_disputes")
    .select("raised_by")
    .eq("id", disputeId)
    .maybeSingle();
  if (derr || !dispute) return { ok: false, status: "not_found" };
  if ((dispute as { raised_by: string }).raised_by !== userId) {
    return { ok: false, status: "forbidden" };
  }

  const { error } = await session
    .from("tournament_disputes")
    .update({ status: "WITHDRAWN" })
    .eq("id", disputeId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", id: disputeId };
}

export const __test = {
  TOURNAMENT_STATUSES,
  MATCH_STATUSES,
  DISPUTE_STATUSES,
  TOURNAMENT_FORMATS,
  isUuid,
  clamp,
  UUID_RE,
  MAX_QUERY_LEN,
  MAX_PAGE,
  MAX_NAME_LEN,
  MAX_TEAM_NAME_LEN,
  MAX_REASON_LEN,
};
