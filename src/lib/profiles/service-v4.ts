// ============================================================================
// src/lib/profiles/service-v4.ts
// V4 — Gaming Profile Enhancement (additive, extends V3 profiles).
//
// Security model:
//   - Only the OWNER can edit their own gaming identity. Identity is resolved
//     server-side (createAdminClient + auth.getUser()), never from the client.
//   - Reads are handled by the profile's existing RLS (owner + public fields).
//   - No new table: enriches `profiles` via migration 022 (safe ALTER ADD).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GamingProfile {
  id: string;
  gaming_handle: string | null;
  platforms: string[] | null;
  favorite_games: string[] | null;
  play_style: string | null;
  lfg_available: boolean;
  presence_state: string | null;
}

const PLATFORMS = ["pc", "playstation", "xbox", "switch", "mobile", "cloud"] as const;
const PLAY_STYLES = ["casual", "competitive", "hardcore", "streamer", "chill", "ranked"] as const;
const PRESENCE = ["offline", "online", "away", "in_voice"] as const;

function cleanTags(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, max)
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => x.length > 0 && x.length <= 32 && /^[a-z0-9_\-]+$/.test(x))
    .slice(0, max);
}

function cleanEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = String(v ?? "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

export async function updateGamingProfile(
  input: Partial<Omit<GamingProfile, "id">>
): Promise<{ ok: true }> {
  const admin = createAdminClient();
  const { data: u, error: authErr } = await admin.auth.getUser();
  if (authErr || !u?.user) throw new Error("Not authenticated");
  const userId = u.user.id;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.gaming_handle !== undefined) {
    const h = String(input.gaming_handle ?? "").trim().slice(0, 32);
    if (h.length > 0 && !/^[a-zA-Z0-9_\- ]+$/.test(h)) {
      throw new Error("gaming_handle may only contain letters, numbers, space, _ and -");
    }
    patch.gaming_handle = h.length > 0 ? h : null;
  }
  if (input.platforms !== undefined) patch.platforms = cleanTags(input.platforms, 6);
  if (input.favorite_games !== undefined) patch.favorite_games = cleanTags(input.favorite_games, 12);
  if (input.play_style !== undefined) patch.play_style = cleanEnum(input.play_style, PLAY_STYLES);
  if (input.lfg_available !== undefined) patch.lfg_available = Boolean(input.lfg_available);
  if (input.presence_state !== undefined) {
    const p = cleanEnum(input.presence_state, PRESENCE);
    if (!p) throw new Error("Invalid presence_state");
    patch.presence_state = p;
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getGamingProfile(
  userId: string
): Promise<GamingProfile | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("profiles")
    .select("id, gaming_handle, platforms, favorite_games, play_style, lfg_available, presence_state")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as GamingProfile;
}

export const __v4Gaming = { cleanTags, cleanEnum, PLATFORMS, PLAY_STYLES, PRESENCE };