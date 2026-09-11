// ============================================================================
// src/lib/profiles/actions.ts
// Server actions that wrap the V4 gaming profile service with result-object
// returns (never throw across the action boundary).
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateGamingProfile } from "@/lib/profiles/service-v4";

export type GamingProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateGamingProfileAction(
  input: Parameters<typeof updateGamingProfile>[0],
): Promise<GamingProfileActionResult> {
  try {
    await updateGamingProfile(input);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update gaming profile.",
    };
  }
  revalidatePath("/settings");
  revalidatePath("/profile");
  return { ok: true };
}
// ---------------------------------------------------------------------------
// updateNotificationPrefs
// Persists the JSONB notification_prefs to the current user's profile row.
// Keys are channel names; values are booleans (opt-out model).
// ---------------------------------------------------------------------------

const VALID_KEYS = new Set(["comments", "replies", "votes", "follows", "events", "mentions"]);

export async function updateNotificationPrefs(
  prefs: Record<string, boolean>,
): Promise<GamingProfileActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Only allow known keys; drop anything unexpected.
  const sanitised: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (VALID_KEYS.has(k)) sanitised[k] = Boolean(v);
  }
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: sanitised })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save preferences." };
  return { ok: true };
}
