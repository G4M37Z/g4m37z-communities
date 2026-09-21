// ============================================================================
// src/lib/gaming/actions.ts
// Server actions wrapping the Phase 1 gaming identity service. Result-object
// returns (never throw across the action boundary), matching the convention
// in lib/profiles/actions.ts. All authorization lives in the service layer +
// the 052 RLS policies; actions only revalidate.
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import {
  addGameStatus,
  removeGameStatus,
  saveGameIdentity,
  deleteGameIdentity,
  setGamingVisibility,
} from "./service";
import type { GameIdentityInput, GamingVisibility } from "./types";

export type GamingActionResult = { ok: true } | { ok: false; error: string };

export interface GamePick {
  id: string;
  name: string;
  slug: string;
  cover_url: string | null;
}

/** Catalogue search for the library manager (server-side, auth-gated). */
export async function searchGamesAction(
  query: string,
): Promise<GamePick[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const games = await listGames(supabase, { search: query, limit: 12 });
  return games.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    cover_url: g.cover_url,
  }));
}

export async function addGameStatusAction(input: {
  game_id: unknown;
  status: unknown;
  note?: unknown;
}): Promise<GamingActionResult> {
  const res = await addGameStatus(input);
  if (res.ok) {
    revalidatePath("/gaming");
    revalidatePath("/profile");
  }
  return res;
}

export async function removeGameStatusAction(input: {
  game_id: unknown;
  status: unknown;
}): Promise<GamingActionResult> {
  const res = await removeGameStatus(input);
  if (res.ok) {
    revalidatePath("/gaming");
    revalidatePath("/profile");
  }
  return res;
}

export async function saveGameIdentityAction(
  input: GameIdentityInput,
): Promise<GamingActionResult> {
  const res = await saveGameIdentity(input);
  if (res.ok) {
    revalidatePath("/gaming");
    revalidatePath("/profile");
  }
  return res;
}

export async function deleteGameIdentityAction(input: {
  game_id: unknown;
}): Promise<GamingActionResult> {
  const res = await deleteGameIdentity(input);
  if (res.ok) {
    revalidatePath("/gaming");
    revalidatePath("/profile");
  }
  return res;
}

export async function setGamingVisibilityAction(
  visibility: string,
): Promise<GamingActionResult> {
  const res = await setGamingVisibility(visibility as GamingVisibility);
  if (res.ok) {
    revalidatePath("/gaming");
    revalidatePath("/profile");
  }
  return res;
}
