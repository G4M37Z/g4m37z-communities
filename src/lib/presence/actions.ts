// ============================================================================
// src/lib/presence/actions.ts
// Server Action for the V4 presence state (025_v4_presence_state.sql).
//
// The user_presence row is upserted via unique user_id. RLS permits the owner
// to INSERT their own row and UPDATE their own row. Presence state is the
// single source of truth for online/away/in_voice indicators.
// ============================================================================

"use server";

import { createClient } from "@/lib/supabase/server";

const PRESENCE_STATES = ["offline", "online", "away", "in_voice"] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

const CONTEXT_MAX = 120;

export type PresenceActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updatePresence(
  status: PresenceState,
  activityContext?: string | null,
): Promise<PresenceActionResult> {
  if (!(PRESENCE_STATES as readonly string[]).includes(status)) {
    return { ok: false, error: "Invalid presence state." };
  }
  if (activityContext && activityContext.length > CONTEXT_MAX) {
    return { ok: false, error: "Activity context is too long." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const context = activityContext?.trim() ? activityContext.trim().slice(0, CONTEXT_MAX) : null;

  // Upsert: RLS permits INSERT + UPDATE of own row only.
  const { error } = await supabase.from("user_presence").upsert(
    {
      user_id: user.id,
      status,
      activity_context: context,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: "Could not update presence." };
  return { ok: true };
}

export const presenceStates = PRESENCE_STATES;