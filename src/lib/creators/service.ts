import { createClient } from "@/lib/supabase/server";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string) { return UUID_RE.test(v); }
export const MAX_PAGE = 50; export function clamp(n: number, lo: number, hi: number) { return n < lo ? lo : n > hi ? hi : n; }
export const __test = { isUuid, clamp, MAX_PAGE, UUID_RE };
export async function listCreators() { const s = await createClient(); return s.from("creator_profiles").select("user_id,display_name,bio,verified,follower_count,total_content,created_at").order("created_at", { ascending: false }); }
export async function getCreator(id: string) { const s = await createClient(); return s.from("creator_profiles").select("user_id,display_name,bio,verified,follower_count,total_content,created_at").eq("user_id", id).maybeSingle(); }
