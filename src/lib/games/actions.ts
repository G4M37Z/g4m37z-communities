"use server";
// Game-related server actions. Thin wrappers around the service helpers so
// Client Components can call them. Each action resolves the authenticated
// user from the server-side Supabase session and never trusts client input.

import {
  followGame as followGameService,
  unfollowGame as unfollowGameService,
} from "@/lib/games/service";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function followGameAction(
  gameId: string,
): Promise<ActionResult> {
  const res = await followGameService(gameId);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "Follow failed" };
}

export async function unfollowGameAction(
  gameId: string,
): Promise<ActionResult> {
  const res = await unfollowGameService(gameId);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "Unfollow failed" };
}
