import { createClient } from "@/lib/supabase/server";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string) { return UUID_RE.test(v); }
export const MAX_BODY = 400; export function clamp(n: number, lo: number, hi: number) { return n < lo ? lo : n > hi ? hi : n; }
export const __test = { isUuid, clamp, MAX_BODY, UUID_RE };
export async function listFollows(userId: string) { const s = await createClient(); return s.from("follows").select("*").eq("follower_id", userId); }
export async function listBlocks(userId: string) { const s = await createClient(); return s.from("blocks").select("*").eq("blocker_id", userId); }
export async function listNotifications(userId: string) { const s = await createClient(); return s.from("notification_events").select("*").eq("user_id", userId).order("created_at", {ascending:false}).limit(50); }
