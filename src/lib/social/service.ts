// ============================================================================
// src/lib/social/service.ts
// V3.9 — Social Graph service (full implementation).
//
// Security model:
//   - Reads and mutations of the CALLING USER's own edges use the
//     request-scoped Supabase client; RLS (021) scopes SELECT/INSERT/DELETE
//     to auth.uid() on each pair table (follows / blocks / mutes) and to
//     notification_events.user_id.
//   - The acting uid is always resolved server-side via auth.getUser();
//     clients can never inject follower_id / blocker_id / muter_id / user_id.
//   - Followers feed special case: RLS (021) only lets a user SELECT rows
//     where follower_id = auth.uid(), so a follower list (rows where
//     followed_id = auth.uid()) is filtered away by RLS. listFollowers()
//     therefore uses the admin client AFTER verifying the requested user is
//     the caller — an admin-side read of one's own follower rows only.
//   - Pure verdict helpers + frozen bounds exported via `__test` for
//     deterministic unit coverage (see tests/social-service.test.ts).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_PAGE = 50;

export interface EdgeTarget {
  user_id: string;
  display_name: string | null;
  created_at: string | null;
}

export interface NotificationEvent {
  id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  payload: Record<string, unknown> | null;
  delivered: boolean;
  read: boolean;
  created_at: string;
}

export type SocialResult =
  | { ok: true; status: "followed" | "unfollowed" | "blocked" | "unblocked" | "muted" | "unmuted" | "deleted" | "read"; target_id?: string }
  | { ok: false; status: "error" | "not_found" | "forbidden" | "self" | "duplicate" | "invalid"; error: string };

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable — exported via __test)
// ---------------------------------------------------------------------------

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type EdgeVerdict = "ok" | "self" | "duplicate";

export function edgeVerdict(isSelf: boolean, alreadyExists: boolean): EdgeVerdict {
  if (isSelf) return "self";
  if (alreadyExists) return "duplicate";
  return "ok";
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<{ uid: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { uid: null, error: "Not signed in." };
  return { uid: user.id };
}

// Batch display-name lookups so the service never depends on FK constraint
// names for joins (the "follows_followed_id_fkey" aliases are not committed).
async function attachDisplayNames(client: SupabaseClient, userIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data } = await client.from("profiles").select("id, display_name").in("id", unique);
  for (const row of data ?? []) map.set(row.id, row.display_name);
  return map;
}

export async function listFollowing(opts: { limit?: number } = {}): Promise<EdgeTarget[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];

  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 50, 1, MAX_PAGE);
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, followed_id, followed_at")
    .eq("follower_id", uid)
    .order("followed_at", { ascending: false })
    .limit(limit);
  if (error) return [];

  const names = await attachDisplayNames(supabase, (data ?? []).map((r: { followed_id: string }) => r.followed_id));
  return (data ?? []).map((row: { followed_id: string; followed_at: string | null }) => ({
    user_id: row.followed_id,
    display_name: names.get(row.followed_id) ?? null,
    created_at: row.followed_at ?? null,
  }));
}

export async function listFollowers(opts: { limit?: number } = {}): Promise<EdgeTarget[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];

  // RLS (021) only exposes rows where follower_id = auth.uid(), so a follower
  // list (followed_id = auth.uid()) must be read via the admin client after
  // confirming the caller is asking about themselves.
  const admin = await createAdminClient();
  const limit = clamp(opts.limit ?? 50, 1, MAX_PAGE);
  const { data, error } = await admin
    .from("follows")
    .select("follower_id, followed_id, followed_at")
    .eq("followed_id", uid)
    .order("followed_at", { ascending: false })
    .limit(limit);
  if (error) return [];

  const names = await attachDisplayNames(admin, (data ?? []).map((r) => r.follower_id));
  return (data ?? []).map((row) => ({
    user_id: row.follower_id,
    display_name: names.get(row.follower_id) ?? null,
    created_at: row.followed_at ?? null,
  }));
}

export async function listBlocked(opts: { limit?: number } = {}): Promise<EdgeTarget[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];

  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 50, 1, MAX_PAGE);
  const { data, error } = await supabase
    .from("blocks")
    .select("blocker_id, blocked_id, blocked_at")
    .eq("blocker_id", uid)
    .order("blocked_at", { ascending: false })
    .limit(limit);
  if (error) return [];

  const names = await attachDisplayNames(supabase, (data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
  return (data ?? []).map((row: { blocked_id: string; blocked_at: string | null }) => ({
    user_id: row.blocked_id,
    display_name: names.get(row.blocked_id) ?? null,
    created_at: row.blocked_at ?? null,
  }));
}

export async function listMuted(opts: { limit?: number } = {}): Promise<EdgeTarget[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];

  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 50, 1, MAX_PAGE);
  const { data, error } = await supabase
    .from("mutes")
    .select("muter_id, muted_id, muted_at")
    .eq("muter_id", uid)
    .order("muted_at", { ascending: false })
    .limit(limit);
  if (error) return [];

  const names = await attachDisplayNames(supabase, (data ?? []).map((r: { muted_id: string }) => r.muted_id));
  return (data ?? []).map((row: { muted_id: string; muted_at: string | null }) => ({
    user_id: row.muted_id,
    display_name: names.get(row.muted_id) ?? null,
    created_at: row.muted_at ?? null,
  }));
}

export async function listNotificationEvents(opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationEvent[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];

  const supabase = await createClient();
  const limit = clamp(opts.limit ?? 50, 1, MAX_PAGE);
  let query = supabase
    .from("notification_events")
    .select("id, event_type, source_type, source_id, payload, delivered, read, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as NotificationEvent[];
}

// ---------------------------------------------------------------------------
// Edge mutations (RLS-scoped: only the caller's own rows)
// ---------------------------------------------------------------------------

export async function followUser(targetId: string): Promise<SocialResult> {
  return setEdge("follows", targetId, true);
}

export async function unfollowUser(targetId: string): Promise<SocialResult> {
  return setEdge("follows", targetId, false);
}

export async function blockUser(targetId: string): Promise<SocialResult> {
  return setEdge("blocks", targetId, true);
}

export async function unblockUser(targetId: string): Promise<SocialResult> {
  return setEdge("blocks", targetId, false);
}

export async function muteUser(targetId: string): Promise<SocialResult> {
  return setEdge("mutes", targetId, true);
}

export async function unmuteUser(targetId: string): Promise<SocialResult> {
  return setEdge("mutes", targetId, false);
}

async function setEdge(table: "follows" | "blocks" | "mutes", targetId: string, shouldCreate: boolean): Promise<SocialResult> {
  if (!isUuid(targetId)) return { ok: false, status: "invalid", error: "Invalid target id." };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const ownerKey = table === "follows" ? "follower_id" : table === "blocks" ? "blocker_id" : "muter_id";
  const targetKey = table === "follows" ? "followed_id" : table === "blocks" ? "blocked_id" : "muted_id";

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from(table)
    .select(ownerKey)
    .eq(ownerKey, uid)
    .eq(targetKey, targetId)
    .maybeSingle();

  const verdict = edgeVerdict(uid === targetId, Boolean(existing));

  if (shouldCreate) {
    if (verdict === "self") return { ok: false, status: "self", error: "You cannot target yourself." };
    if (verdict === "duplicate") return { ok: false, status: "duplicate", error: `Already ${table === "follows" ? "following" : table === "blocks" ? "blocking" : "muting"} this user.` };

    const { error } = await supabase.from(table).insert({ [ownerKey]: uid, [targetKey]: targetId });
    if (error) {
      if (error.code === "23505") return { ok: false, status: "duplicate", error: "That edge already exists." };
      return { ok: false, status: "error", error: error.message };
    }
    return {
      ok: true,
      status: table === "follows" ? "followed" : table === "blocks" ? "blocked" : "muted",
      target_id: targetId,
    };
  }

  if (verdict === "self") return { ok: false, status: "self", error: "You cannot target yourself." };
  if (!existing) return { ok: false, status: "duplicate", error: "That edge does not exist." };

  const { error } = await supabase.from(table).delete().eq(ownerKey, uid).eq(targetKey, targetId);
  if (error) return { ok: false, status: "error", error: error.message };

  return {
    ok: true,
    status: table === "follows" ? "unfollowed" : table === "blocks" ? "unblocked" : "unmuted",
    target_id: targetId,
  };
}

// ---------------------------------------------------------------------------
// Notification events (mark read)
// ---------------------------------------------------------------------------

export async function markNotificationEventRead(eventId: string): Promise<SocialResult> {
  if (!isUuid(eventId)) return { ok: false, status: "invalid", error: "Invalid event id." };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_events")
    .update({ read: true })
    .eq("id", eventId)
    .eq("user_id", uid);
  if (error) return { ok: false, status: "error", error: error.message };

  return { ok: true, status: "read", target_id: eventId };
}

export async function markAllNotificationEventsRead(): Promise<SocialResult> {
  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_events")
    .update({ read: true })
    .eq("user_id", uid)
    .eq("read", false);
  if (error) return { ok: false, status: "error", error: error.message };

  return { ok: true, status: "read" };
}

export const __test = {
  isUuid,
  clamp,
  MAX_PAGE,
  edgeVerdict,
};