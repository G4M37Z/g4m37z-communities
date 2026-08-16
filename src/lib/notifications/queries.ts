// ============================================================================
// src/lib/notifications/queries.ts
// Read-only query helpers for notifications. Server-side only.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types/database";

export async function getMyNotifications(
  limit = 50,
  offset = 0,
  unreadOnly = false
): Promise<Notification[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data } = await query;
  return (data as Notification[]) ?? [];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return count ?? 0;
}