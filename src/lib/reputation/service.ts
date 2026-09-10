// ============================================================================
// src/lib/reputation/service.ts
// V3 Phase 1 / V3.1 — Reputation system.
//
// Security model:
//   - All writes go through the service_role client (createAdminClient) which
//     bypasses RLS. No client-side mutation path exists.
//   - event_type and source_type are validated against the controlled enums
//     in 012_reputation_policies.sql before insert.
//   - The (user_id, source_type, source_id, event_type) UNIQUE constraint in
//     the database prevents duplicate events for the same source.
//   - weight is constrained to a sane integer range (-1000..1000).
//
// Usage:
//   import { recordReputationEvent, getUserReputation } from "@/lib/reputation/service";
//   await recordReputationEvent({ userId, sourceType: "post", sourceId,
//     eventType: "POST_CREATED", weight: 5 });
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const REPUTATION_EVENT_TYPES = [
  "POST_CREATED",
  "POST_UPVOTED",
  "POST_DOWNVOTED",
  "COMMENT_CREATED",
  "COMMENT_UPVOTED",
  "COMMENT_DOWNVOTED",
  "COMMUNITY_JOINED",
  "COMMUNITY_CREATED",
  "EVENT_CREATED",
  "EVENT_PARTICIPATED",
  "LFG_HOSTED",
  "LFG_PARTICIPATED",
  "TOURNAMENT_REGISTERED",
  "TOURNAMENT_COMPLETED",
  "REVIEW_POSTED",
  "GAME_FOLLOWED",
  "ACHIEVEMENT_EARNED",
  "MESSAGE_SENT",
] as const;

export type ReputationEventType = (typeof REPUTATION_EVENT_TYPES)[number];

export const REPUTATION_SOURCE_TYPES = [
  "post",
  "comment",
  "community",
  "event",
  "lfg_session",
  "tournament",
  "review",
  "game",
  "achievement",
  "message",
  "profile",
] as const;

export type ReputationSourceType = (typeof REPUTATION_SOURCE_TYPES)[number];

export interface RecordReputationInput {
  userId: string;
  sourceType: ReputationSourceType;
  sourceId: string;
  eventType: ReputationEventType;
  weight?: number;
}

export interface RecordReputationResult {
  ok: boolean;
  /** "inserted" — new row created; "duplicate" — already existed, no change. */
  status: "inserted" | "duplicate" | "error";
  error?: string;
}

/** Allowed weight range to prevent integer overflow or pathological values. */
const MIN_WEIGHT = -1000;
const MAX_WEIGHT = 1000;

function isUuid(value: string): boolean {
  // Cheap UUID check; sufficient to catch obvious bad input. Full validation
  // happens server-side via the column type.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Record a reputation event. Idempotent: a duplicate (userId, sourceType,
 * sourceId, eventType) tuple is treated as success without re-inserting.
 *
 * Must only be called from trusted server code (Server Actions, Route
 * Handlers, webhooks). The service_role client is required to bypass RLS.
 */
export async function recordReputationEvent(
  input: RecordReputationInput,
): Promise<RecordReputationResult> {
  // Validate input shape before touching the database.
  if (!input || typeof input !== "object") {
    return { ok: false, status: "error", error: "Invalid input" };
  }
  if (!isUuid(input.userId)) {
    return { ok: false, status: "error", error: "Invalid userId" };
  }
  if (!isUuid(input.sourceId)) {
    return { ok: false, status: "error", error: "Invalid sourceId" };
  }
  if (
    !REPUTATION_SOURCE_TYPES.includes(
      input.sourceType as ReputationSourceType,
    )
  ) {
    return { ok: false, status: "error", error: "Invalid sourceType" };
  }
  if (
    !REPUTATION_EVENT_TYPES.includes(
      input.eventType as ReputationEventType,
    )
  ) {
    return { ok: false, status: "error", error: "Invalid eventType" };
  }
  const weight = input.weight ?? 1;
  if (
    !Number.isInteger(weight) ||
    weight < MIN_WEIGHT ||
    weight > MAX_WEIGHT
  ) {
    return { ok: false, status: "error", error: "Invalid weight" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("reputation_events").insert({
    user_id: input.userId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    event_type: input.eventType,
    weight,
  });

  if (!error) return { ok: true, status: "inserted" };

  // Postgres unique-violation => duplicate. Treat as a successful no-op.
  if (error.code === "23505") return { ok: true, status: "duplicate" };

  return { ok: false, status: "error", error: error.message };
}

/**
 * Total reputation score for a user. Returns 0 if the user has no events.
 * Uses the regular client (SELECT is public per RLS).
 */
export async function getUserReputation(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!isUuid(userId)) return 0;
  const { data, error } = await supabase
    .from("reputation_events")
    .select("weight")
    .eq("user_id", userId);
  if (error || !data) return 0;
  return data.reduce<number>((sum, row) => sum + (row.weight ?? 0), 0);
}

/**
 * Count of distinct reputation events for a user (event count, not score).
 */
export async function getUserReputationEventCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!isUuid(userId)) return 0;
  const { count, error } = await supabase
    .from("reputation_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error || typeof count !== "number") return 0;
  return count;
}
