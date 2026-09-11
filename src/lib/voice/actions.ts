// ============================================================================
// src/lib/voice/actions.ts
// Server Actions for community voice rooms (009_v1_expression_voice.sql).
// RLS: community members may create rooms; self-insert/delete participants.
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updatePresence } from "@/lib/presence/actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VoiceActionResult =
  | { ok: true; roomId?: string }
  | { ok: false; error: string };

export async function createVoiceRoom(
  communityId: string,
  name: string,
): Promise<VoiceActionResult> {
  const n = name.trim();
  if (n.length < 2) return { ok: false, error: "Room name is too short." };
  if (n.length > 60) return { ok: false, error: "Room name is too long." };
  if (!UUID_RE.test(communityId)) return { ok: false, error: "Invalid community." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to create a voice room." };

  // Only community members may create rooms (mirrors RLS intent).
  const { data: membership } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Join the community to create a room." };

  const { data: room, error } = await supabase
    .from("voice_rooms")
    .insert({ community_id: communityId, name: n, created_by: user.id })
    .select("id, community_id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not create the voice room." };
  if (!room) return { ok: false, error: "Voice room creation returned no data." };

  // Creator auto-joins as moderator.
  await supabase.from("voice_room_participants").upsert(
    { room_id: room.id, user_id: user.id, role: "moderator", is_muted: false },
    { onConflict: "room_id,user_id" },
  );

  const { data: community } = await supabase
    .from("communities")
    .select("slug")
    .eq("id", room.community_id)
    .maybeSingle();
  const slug = (community as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/communities/${slug}/voice`);
  return { ok: true, roomId: room.id };
}

export async function joinVoiceRoom(roomId: string): Promise<VoiceActionResult> {
  if (!UUID_RE.test(roomId)) return { ok: false, error: "Invalid room." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to join." };

  const { data: existing } = await supabase
    .from("voice_room_participants")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("voice_room_participants").insert({
      room_id: roomId,
      user_id: user.id,
      role: "listener",
      is_muted: false,
    });
    if (error) return { ok: false, error: "Could not join the room." };
  }
  await updatePresence("in_voice");
  revalidatePath(`/voice/${roomId}`);
  return { ok: true };
}

export async function leaveVoiceRoom(roomId: string): Promise<VoiceActionResult> {
  if (!UUID_RE.test(roomId)) return { ok: false, error: "Invalid room." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await supabase
    .from("voice_room_participants")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  await updatePresence("online");

  const { data: room } = await supabase
    .from("voice_rooms")
    .select("community_id, name, created_by")
    .eq("id", roomId)
    .maybeSingle();

  // If the creator left an empty room, close it.
  if (room && room.created_by === user.id) {
    const { count } = await supabase
      .from("voice_room_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("room_id", roomId);
    if ((count ?? 0) === 0) {
      await supabase.from("voice_rooms").update({ is_active: false }).eq("id", roomId);
    }
  }

  revalidatePath(`/voice/${roomId}`);
  const community = room
    ? await supabase
        .from("communities")
        .select("slug")
        .eq("id", room.community_id)
        .maybeSingle()
    : null;
  const slug = (community?.data as { slug: string } | null)?.slug;
  if (slug) revalidatePath(`/communities/${slug}/voice`);
  return { ok: true };
}