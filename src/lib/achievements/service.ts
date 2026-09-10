// ============================================================================
// src/lib/achievements/service.ts
// V3 Phase 1 / V3.2 — Achievement system.
//
// Security model:
//   - Reads use the regular Supabase client (RLS allows public SELECT).
//   - Writes go through createAdminClient (service_role) so they bypass RLS.
//     There is no client-side path that can grant achievements.
//   - The (user_id, achievement_id) PRIMARY KEY on user_achievements enforces
//     duplicate prevention at the database level. Idempotent inserts treat
//     Postgres unique-violation (23505) as a successful no-op.
//   - achievement_id and user_id are validated as UUIDs at the service
//     boundary; achievement_id must reference a real row (verified by
//     `getAchievementById` lookup before insert).
//
// Criteria shapes (V3.2 supported):
//   { "type": "reputation_threshold", "value": <int> }
//   { "type": "posts_created",        "value": <int> }
//   { "type": "events_attended",      "value": <int> }
//   { "type": "manual",               "note": "<text>" }
//
// `manual` achievements can only be awarded via awardAchievementById — the
// evaluator never auto-awards them.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria: AchievementCriteria;
  created_at: string;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  earned_at: string;
}

export type AchievementCriteria =
  | { type: "reputation_threshold"; value: number }
  | { type: "posts_created"; value: number }
  | { type: "events_attended"; value: number }
  | { type: "manual"; note?: string };

export interface AwardResult {
  ok: boolean;
  status: "inserted" | "duplicate" | "not_found" | "error";
  error?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isValidCriteria(c: unknown): c is AchievementCriteria {
  if (!c || typeof c !== "object") return false;
  const obj = c as { type?: unknown; value?: unknown; note?: unknown };
  switch (obj.type) {
    case "reputation_threshold":
    case "posts_created":
    case "events_attended":
      return Number.isInteger(obj.value) && (obj.value as number) >= 0;
    case "manual":
      return obj.note === undefined || typeof obj.note === "string";
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Reads — public via RLS.
// ---------------------------------------------------------------------------

export async function listAchievements(
  supabase: SupabaseClient,
): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("id, name, description, icon_url, criteria, created_at")
    .order("name");
  if (error || !data) return [];
  const filtered: Achievement[] = [];
  for (const row of data as Array<{
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    criteria: unknown;
    created_at: string;
  }>) {
    if (!isValidCriteria(row.criteria)) continue;
    filtered.push({
      id: row.id,
      name: row.name,
      description: row.description,
      icon_url: row.icon_url,
      criteria: row.criteria,
      created_at: row.created_at,
    });
  }
  return filtered;
}

export async function getAchievementByName(
  supabase: SupabaseClient,
  name: string,
): Promise<Achievement | null> {
  if (!name || name.length === 0 || name.length > 200) return null;
  const { data, error } = await supabase
    .from("achievements")
    .select("id, name, description, icon_url, criteria, created_at")
    .eq("name", name)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    criteria: unknown;
    created_at: string;
  };
  if (!isValidCriteria(row.criteria)) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon_url: row.icon_url,
    criteria: row.criteria,
    created_at: row.created_at,
  };
}

export async function getUserAchievements(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAchievement[]> {
  if (!isUuid(userId)) return [];
  const { data, error } = await supabase
    .from("user_achievements")
    .select("user_id, achievement_id, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (error || !data) return [];
  return data as UserAchievement[];
}

// ---------------------------------------------------------------------------
// Evaluator — deterministic, side-effect-free.
// Returns the list of achievement IDs the user has just become eligible for,
// given a snapshot of their current activity counters.
// ---------------------------------------------------------------------------

export interface ActivitySnapshot {
  reputationScore: number;
  postsCreated: number;
  eventsAttended: number;
}

export function evaluateAchievementEligibility(
  snapshot: ActivitySnapshot,
  achievements: Achievement[],
): string[] {
  const eligible: string[] = [];
  for (const a of achievements) {
    const c = a.criteria;
    switch (c.type) {
      case "reputation_threshold":
        if (snapshot.reputationScore >= c.value) eligible.push(a.id);
        break;
      case "posts_created":
        if (snapshot.postsCreated >= c.value) eligible.push(a.id);
        break;
      case "events_attended":
        if (snapshot.eventsAttended >= c.value) eligible.push(a.id);
        break;
      case "manual":
        // Never auto-eligible.
        break;
    }
  }
  return eligible;
}

// ---------------------------------------------------------------------------
// Writes — service_role only.
// ---------------------------------------------------------------------------

/**
 * Award an achievement by name. Idempotent: a duplicate award is treated
 * as success without re-inserting. Returns:
 *   - { ok: true, status: "inserted" }   — new row created
 *   - { ok: true, status: "duplicate" }  — already had it
 *   - { ok: false, status: "not_found" } — no achievement with that name
 *   - { ok: false, status: "error" }     — other failure
 */
export async function awardAchievementByName(
  userId: string,
  achievementName: string,
): Promise<AwardResult> {
  if (!isUuid(userId)) return { ok: false, status: "error", error: "Invalid userId" };
  if (!achievementName || achievementName.length === 0 || achievementName.length > 200) {
    return { ok: false, status: "error", error: "Invalid achievementName" };
  }
  const supabase = createAdminClient();
  const { data: ach, error: lookupErr } = await supabase
    .from("achievements")
    .select("id")
    .eq("name", achievementName)
    .maybeSingle();
  if (lookupErr) return { ok: false, status: "error", error: lookupErr.message };
  if (!ach) return { ok: false, status: "not_found", error: "Achievement not found" };

  const { error } = await supabase
    .from("user_achievements")
    .insert({ user_id: userId, achievement_id: (ach as { id: string }).id });
  if (!error) return { ok: true, status: "inserted" };
  if (error.code === "23505") return { ok: true, status: "duplicate" };
  return { ok: false, status: "error", error: error.message };
}

/**
 * Award an achievement by id (UUID). Same idempotency guarantees as
 * `awardAchievementByName`. Provided for callers that have already resolved
 * the achievement id.
 */
export async function awardAchievementById(
  userId: string,
  achievementId: string,
): Promise<AwardResult> {
  if (!isUuid(userId)) return { ok: false, status: "error", error: "Invalid userId" };
  if (!isUuid(achievementId)) return { ok: false, status: "error", error: "Invalid achievementId" };
  const supabase = createAdminClient();

  // Verify the achievement actually exists before inserting.
  const { data: ach, error: lookupErr } = await supabase
    .from("achievements")
    .select("id")
    .eq("id", achievementId)
    .maybeSingle();
  if (lookupErr) return { ok: false, status: "error", error: lookupErr.message };
  if (!ach) return { ok: false, status: "not_found", error: "Achievement not found" };

  const { error } = await supabase
    .from("user_achievements")
    .insert({ user_id: userId, achievement_id: achievementId });
  if (!error) return { ok: true, status: "inserted" };
  if (error.code === "23505") return { ok: true, status: "duplicate" };
  return { ok: false, status: "error", error: error.message };
}

/**
 * High-level helper: load all achievements + the user's snapshot + already-
 * earned set, then award everything newly eligible. Returns the list of
 * achievement IDs that were newly awarded (duplicates excluded).
 */
export async function evaluateAndAward(
  userId: string,
  snapshot: ActivitySnapshot,
): Promise<{ awarded: string[]; skipped: number; errors: string[] }> {
  if (!isUuid(userId)) {
    return { awarded: [], skipped: 0, errors: ["Invalid userId"] };
  }
  const supabase = createAdminClient();
  const [achievements, earnedRows] = await Promise.all([
    listAchievements(supabase),
    getUserAchievements(supabase, userId),
  ]);
  const alreadyEarned = new Set(earnedRows.map((r) => r.achievement_id));
  const eligible = evaluateAchievementEligibility(snapshot, achievements).filter(
    (id) => !alreadyEarned.has(id),
  );
  const awarded: string[] = [];
  const errors: string[] = [];
  let skipped = alreadyEarned.size;
  for (const id of eligible) {
    const res = await awardAchievementById(userId, id);
    if (res.ok) awarded.push(id);
    else if (res.status === "duplicate") skipped++;
    else errors.push(res.error ?? "unknown");
  }
  return { awarded, skipped, errors };
}
