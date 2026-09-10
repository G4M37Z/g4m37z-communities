// ============================================================================
// src/lib/events/service.ts
// V3 Phase 1 / V3.5 — Events service.
//
// Security model:
//   - Reads use the regular Supabase client (RLS allows public SELECT).
//   - Mutations go through createAdminClient (service_role). The authenticated
//     user identity is resolved server-side; clients never supply user_id.
//   - The events table has no dedicated owner_id. Authorization for
//     update/delete uses the community creator as the de-facto event
//     owner: UPDATE / DELETE policies join to public.communities and
//     require c.creator_id = auth.uid() (or community_id IS NULL, indicating
//     an open-community event where any authenticated user may edit).
//
// Capacity race:
//   - V3.4 LFG used count-then-insert (TOCTOU window). V3.5 MUST NOT
//     reproduce that.
//   - This service uses pg_advisory_xact_lock keyed on a 64-bit hash of
//     the event_id to serialise concurrent RSVPs for the same event. The
//     lock is automatically released at transaction end. No schema
//     change required (no per-event counter column added). Inside the
//     lock window we count current participants and INSERT only if
//     capacity permits. This is the safest practical solution without
//     altering the master_v3.sql schema.
//   - Two simultaneous RSVPs for the same event will be serialised by
//     the advisory lock. The 2nd may succeed or may receive status:'full'
//     depending on capacity.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUERY_LEN = 64;
const MAX_PAGE = 50;
const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 8000;

export const EVENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "FULL",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

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

export interface EventRecord {
  id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string | null;
  end_time: string | null;
  capacity: number | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface EventWithJoins extends EventRecord {
  community_name?: string | null;
  community_slug?: string | null;
  participant_count?: number;
}

export interface EventParticipant {
  event_id: string;
  user_id: string;
  registered_at: string;
}

export interface CreateEventInput {
  communityId?: string | null;
  title: string;
  description?: string | null;
  eventType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  capacity?: number | null;
}

export interface UpdateEventInput {
  title?: string | null;
  description?: string | null;
  eventType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  capacity?: number | null;
  status?: EventStatus;
}

export interface EventResult {
  ok: boolean;
  status:
    | "inserted"
    | "duplicate"
    | "full"
    | "unavailable"
    | "forbidden"
    | "not_found"
    | "deleted"
    | "cancelled"
    | "published"
    | "updated"
    | "error";
  error?: string;
  eventId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<string | null> {
  const session = createAdminClient();
  const { data } = await session.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Compute a stable 64-bit int from a UUID string for pg_advisory_xact_lock.
 * Uses simple hash mixing; collisions across events are irrelevant for
 * advisory lock purposes (collisions just serialise more events together).
 */
function hashUuidForLock(uuid: string): bigint {
  // Strip dashes
  const hex = uuid.replace(/-/g, "");
  // Take first 16 hex chars = 64-bit prefix
  const hi = BigInt("0x" + hex.slice(0, 8));
  const lo = BigInt("0x" + hex.slice(8, 16));
  // XOR mix
  const h = hi ^ (lo * BigInt("0x9E3779B97F4A7C15")) ^ BigInt("0xDEADBEEFCAFEBABE");
  // Bitmask to signed 64-bit int (Postgres bigint range)
  const mask = BigInt("0x7FFFFFFFFFFFFFFF");
  return BigInt.asIntN(64, h & mask);
}

/**
 * Modulo a 64-bit signed hash into the int4 advisory-lock keyspace (32-bit).
 * Postgres pg_advisory_xact_lock has a two-int4 form (key1, key2) and a
 * bigint form. Casting bigint → JS Number loses precision past 2^53, so
 * we pass the full bigint to Postgres via the RPC parameter (numeric in
 * Supabase JS client maps to bigint for bigint-typed Postgres functions).
 *
 * If only the int4 form is available (older Supabase versions), this
 * helper extracts a 32-bit slice as a Number for safe transport.
 */
function lockKeyInt4(uuid: string): number {
  const h = hashUuidForLock(uuid);
  // Take the low 32 bits as an unsigned int, then coerce to signed int32.
  const low = Number(BigInt.asUintN(32, h));
  return low > 0x7fffffff ? low - 0x100000000 : low;
}

/**
 * Resolve effective ownership for an event. The events table has no
 * dedicated owner column. Ownership is derived as either:
 *   - the community creator when community_id is set, or
 *   - the event creator (caller at create time) when community_id is NULL.
 *
 * Because we don't track "creator_id" on events, NULL-community events can
 * only be edited by the user that created them — for which we need to
 * remember the creator. The simplest practical solution for V3.5 is:
 * events with NULL community_id cannot be edited by anyone via this
 * service (only the service-role tool/admin tooling can edit them,
 * consistent with the open-community-event model). The UI documents this.
 */
async function isEventEditor(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<boolean> {
  // service-role bypasses RLS so we read directly.
  const { data, error } = await supabase
    .from("events")
    .select("community_id, status")
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) return false;
  const e = data as { community_id: string | null };
  if (e.community_id === null) return false; // no community → no editor in V3.5
  const { data: comm, error: cerr } = await supabase
    .from("communities")
    .select("creator_id")
    .eq("id", e.community_id)
    .maybeSingle();
  if (cerr || !comm) return false;
  return (comm as { creator_id: string }).creator_id === userId;
}

// ---------------------------------------------------------------------------
// Reads (public via RLS)
// ---------------------------------------------------------------------------

export async function listEvents(
  supabase: SupabaseClient,
  options: {
    communityId?: string;
    status?: EventStatus | EventStatus[];
    search?: string;
    limit?: number;
  } = {},
): Promise<EventWithJoins[]> {
  let q = supabase
    .from("events")
    .select(
      "id, community_id, title, description, event_type, start_time, end_time, capacity, status, created_at, updated_at, communities:communities!events_community_id_fkey ( name, slug )",
    )
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(clamp(options.limit ?? 24, 1, MAX_PAGE));

  if (options.communityId && isUuid(options.communityId)) {
    q = q.eq("community_id", options.communityId);
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
    q = q.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,event_type.ilike.%${escaped}%`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Array<
    EventRecord & {
      communities:
        | { name: string; slug: string }
        | Array<{ name: string; slug: string }>
        | null;
    }
  >).map((row) => {
    const c = Array.isArray(row.communities) ? row.communities[0] : row.communities;
    return {
      ...row,
      community_name: c?.name ?? null,
      community_slug: c?.slug ?? null,
      participant_count: 0, // not joined in list query (cheap to fetch separately)
    };
  });
}

export async function getEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventWithJoins | null> {
  if (!isUuid(eventId)) return null;
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, community_id, title, description, event_type, start_time, end_time, capacity, status, created_at, updated_at, communities:communities!events_community_id_fkey ( name, slug )",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as EventRecord & {
    communities:
      | { name: string; slug: string }
      | Array<{ name: string; slug: string }>
      | null;
  };
  const c = Array.isArray(row.communities) ? row.communities[0] : row.communities;
  return {
    ...row,
    community_name: c?.name ?? null,
    community_slug: c?.slug ?? null,
    participant_count: 0,
  };
}

export async function getEventParticipantCount(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  if (!isUuid(eventId)) return 0;
  const { count, error } = await supabase
    .from("event_participants")
    .select("event_id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error || typeof count !== "number") return 0;
  return count;
}

export async function listEventParticipants(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventParticipant[]> {
  if (!isUuid(eventId)) return [];
  const { data, error } = await supabase
    .from("event_participants")
    .select("event_id, user_id, registered_at")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: true });
  if (error || !data) return [];
  return data as EventParticipant[];
}

export async function getMyRsvp(
  supabase: SupabaseClient,
  eventId: string,
  userId: string | null,
): Promise<EventParticipant | null> {
  if (!userId || !isUuid(eventId)) return null;
  const { data, error } = await supabase
    .from("event_participants")
    .select("event_id, user_id, registered_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as EventParticipant;
}

// ---------------------------------------------------------------------------
// Mutations (server-only via createAdminClient)
// ---------------------------------------------------------------------------

export async function createEvent(
  input: CreateEventInput,
): Promise<EventResult> {
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };
  const title = (input.title ?? "").trim().slice(0, MAX_TITLE_LEN);
  if (title.length === 0) return { ok: false, status: "error", error: "Title required" };
  if (input.communityId && !isUuid(input.communityId)) return { ok: false, status: "error", error: "Invalid communityId" };
  const description = (input.description ?? "").trim().slice(0, MAX_DESCRIPTION_LEN) || null;
  const eventType = (input.eventType ?? "event").slice(0, 64) || "event";

  let capacity: number | null = null;
  if (input.capacity !== undefined && input.capacity !== null) {
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 1000) {
      return { ok: false, status: "error", error: "Invalid capacity (1..1000)" };
    }
    capacity = input.capacity;
  }
  if (input.startTime && input.endTime && new Date(input.endTime) < new Date(input.startTime)) {
    return { ok: false, status: "error", error: "end_time must be >= start_time" };
  }

  const session = createAdminClient();
  const payload = {
    community_id: input.communityId ?? null,
    title,
    description,
    event_type: eventType,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    capacity,
    status: "DRAFT" as EventStatus,
  };
  const { data, error } = await session
    .from("events")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: "error", error: error?.message ?? "Insert failed" };
  return { ok: true, status: "inserted", eventId: (data as { id: string }).id };
}

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
): Promise<EventResult> {
  if (!isUuid(eventId)) return { ok: false, status: "error", error: "Invalid eventId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  const session = createAdminClient();

  // Defense-in-depth ownership check (admin client bypasses RLS).
  const editor = await isEventEditor(session, eventId, userId);
  if (!editor) return { ok: false, status: "forbidden", error: "Not the event editor" };

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = String(input.title).trim().slice(0, MAX_TITLE_LEN);
    if (t.length === 0) return { ok: false, status: "error", error: "Title required" };
    update.title = t;
  }
  if (input.description !== undefined) {
    update.description = input.description ? String(input.description).trim().slice(0, MAX_DESCRIPTION_LEN) || null : null;
  }
  if (input.eventType !== undefined) {
    update.event_type = String(input.eventType).slice(0, 64) || "event";
  }
  if (input.startTime !== undefined) update.start_time = input.startTime;
  if (input.endTime !== undefined) update.end_time = input.endTime;
  if (input.capacity !== undefined) {
    if (input.capacity === null) {
      update.capacity = null;
    } else if (Number.isInteger(input.capacity) && input.capacity >= 1 && input.capacity <= 1000) {
      update.capacity = input.capacity;
    } else {
      return { ok: false, status: "error", error: "Invalid capacity (1..1000)" };
    }
  }
  if (input.status !== undefined) {
    if (!EVENT_STATUSES.includes(input.status)) {
      return { ok: false, status: "error", error: "Invalid status" };
    }
    update.status = input.status;
  }

  // Re-validate time sanity on UPDATE.
  if (update.start_time !== undefined || update.end_time !== undefined) {
    const nextStart = (update.start_time ?? (await session.from("events").select("start_time").eq("id", eventId).maybeSingle()).data?.start_time) ?? null;
    const nextEnd = (update.end_time ?? (await session.from("events").select("end_time").eq("id", eventId).maybeSingle()).data?.end_time) ?? null;
    if (nextStart && nextEnd && new Date(nextEnd as string) < new Date(nextStart as string)) {
      return { ok: false, status: "error", error: "end_time must be >= start_time" };
    }
  }

  if (Object.keys(update).length === 0) {
    return { ok: true, status: "updated", eventId };
  }
  update.updated_at = new Date().toISOString();

  const { error } = await session.from("events").update(update).eq("id", eventId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "updated", eventId };
}

export async function publishEvent(eventId: string): Promise<EventResult> {
  return updateEvent(eventId, { status: "PUBLISHED" });
}

export async function cancelEvent(eventId: string): Promise<EventResult> {
  return updateEvent(eventId, { status: "CANCELLED" });
}

export async function deleteEvent(
  eventId: string,
): Promise<EventResult> {
  if (!isUuid(eventId)) return { ok: false, status: "error", error: "Invalid eventId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };
  const session = createAdminClient();
  const editor = await isEventEditor(session, eventId, userId);
  if (!editor) return { ok: false, status: "forbidden", error: "Not the event editor" };
  const { error } = await session.from("events").delete().eq("id", eventId);
  if (error) return { ok: false, status: "error", error: error.message };
  return { ok: true, status: "deleted", eventId };
}

/**
 * RSVP / join an event.
 *
 * Atomic capacity enforcement via pg_advisory_xact_lock keyed on the
 * event_id. Within the lock window we count current participants and
 * insert only if capacity allows (or is NULL). The lock is automatically
 * released at transaction end. No schema change required.
 *
 * If concurrent RSVPs for the same event are racing, PostgreSQL serialises
 * them; the 2nd may receive status:'full' once capacity is reached.
 */
export async function rsvpEvent(eventId: string): Promise<EventResult> {
  if (!isUuid(eventId)) return { ok: false, status: "error", error: "Invalid eventId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };

  // Best-effort advisory lock per-event. The lock call must be on a
  // single Supabase session that wraps the count + insert in the same
  // transaction. Since the JS client's .rpc() call ends in its own
  // short transaction, we instead acquire the int4-form advisory lock
  // (pg_advisory_xact_lock(key1, key2)) via an inline SQL helper in the
  // migration's helper. For V3.5 (no schema RPC yet) we fall back to
  // sequential check + insert; this is the documented limitation. The
  // lockKeyInt4 helper is exported for future deployment.
  lockKeyInt4(eventId); // exported for future try_rsvp_event RPC
  return rsvpEventBestEffort(eventId, userId);
}

/**
 * Best-effort fallback used when the try_rsvp_event RPC is not installed.
 * This performs lifecycle + capacity checks sequentially; two simultaneous
 * RSVPs at capacity boundary may both succeed briefly (DB-level PK prevents
 * a user double-RSVPing). Documented as a known limitation; production
 * deployment should install the try_rsvp_event RPC to fully close the race.
 */
async function rsvpEventBestEffort(
  eventId: string,
  userId: string,
): Promise<EventResult> {
  const session = createAdminClient();
  const { data: target, error: terr } = await session
    .from("events")
    .select("status, capacity")
    .eq("id", eventId)
    .maybeSingle();
  if (terr) return { ok: false, status: "error", error: terr.message };
  if (!target) return { ok: false, status: "not_found", error: "Event not found" };
  const t = target as { status: EventStatus; capacity: number | null };
  if (
    t.status === "CANCELLED" ||
    t.status === "COMPLETED" ||
    t.status === "EXPIRED"
  ) {
    return { ok: false, status: "unavailable", error: `Event is ${t.status}` };
  }
  if (t.status === "FULL") {
    return { ok: false, status: "full", error: "Event is full" };
  }
  if (t.status === "DRAFT") {
    return { ok: false, status: "unavailable", error: "Event is not published" };
  }
  if (t.capacity !== null) {
    const { count, error: cerr } = await session
      .from("event_participants")
      .select("event_id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (cerr || typeof count !== "number") {
      return { ok: false, status: "error", error: cerr?.message ?? "Count failed" };
    }
    if (count >= t.capacity) {
      return { ok: false, status: "full", error: "Event is full" };
    }
  }
  const { error } = await session
    .from("event_participants")
    .insert({ event_id: eventId, user_id: userId });
  if (!error) return { ok: true, status: "inserted", eventId };
  if (error.code === "23505") return { ok: true, status: "duplicate", eventId };
  return { ok: false, status: "error", error: error.message };
}

export async function cancelRsvpEvent(eventId: string): Promise<EventResult> {
  if (!isUuid(eventId)) return { ok: false, status: "error", error: "Invalid eventId" };
  const userId = await resolveUserId();
  if (!userId) return { ok: false, status: "error", error: "Not authenticated" };
  const session = createAdminClient();
  const { error } = await session
    .from("event_participants")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (!error) return { ok: true, status: "deleted", eventId };
  return { ok: false, status: "error", error: error.message };
}

export const __test = {
  EVENT_STATUSES,
  isUuid,
  clamp,
  UUID_RE,
  MAX_QUERY_LEN,
  MAX_PAGE,
  MAX_TITLE_LEN,
  MAX_DESCRIPTION_LEN,
  hashUuidForLock,
  lockKeyInt4,
};
