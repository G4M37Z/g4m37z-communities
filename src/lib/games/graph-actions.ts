// ============================================================================
// src/lib/games/graph-actions.ts
// Server actions for the Game Graph content integration (Phase 2).
// Auth-gated reads for form selects (catalogue is public data; the gate
// keeps the action surface consistent with the other graph actions).
// ============================================================================

"use server";

import { createClient } from "@/lib/supabase/server";
import { listGames } from "./service";

export interface GameOption {
  id: string;
  name: string;
}

export async function listGamesAction(): Promise<GameOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const games = await listGames(supabase, { limit: 100 });
  return games.map((g) => ({ id: g.id, name: g.name }));
}

/**
 * Validates an optional game_id from form input. Returns null for
 * absent/empty values (game-agnostic content), a uuid when the catalogue
 * contains it, and throws on a provided-but-unknown id.
 */
export async function resolveGameIdAction(
  raw: FormDataEntryValue | null,
): Promise<string | null> {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id")
    .eq("id", s)
    .maybeSingle();
  if (!data) throw new Error("Unknown game selected.");
  return s;
}
