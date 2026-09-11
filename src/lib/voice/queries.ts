// ============================================================================
// src/lib/voice/queries.ts
// Read helpers for community voice rooms (009_v1_expression_voice.sql).
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export interface VoiceRoom {
  id: string;
  community_id: string;
  name: string;
  created_by: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  community?: { slug: string; name: string };
}

export async function listVoiceRooms(communityId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("voice_rooms")
    .select(
      `id, community_id, name, created_by, is_active, is_locked, created_at,
       community:communities!voice_rooms_community_id_fkey ( slug, name )`,
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (communityId) {
    query = query.eq("community_id", communityId);
  }
  const { data, error } = await query;
  return { data: (data as VoiceRoom[] | null) ?? [], error };
}

export async function getVoiceRoom(roomId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_rooms")
    .select(
      `id, community_id, name, created_by, is_active, is_locked, created_at,
       community:communities!voice_rooms_community_id_fkey ( slug, name )`,
    )
    .eq("id", roomId)
    .maybeSingle();
  return (data as VoiceRoom | null) ?? null;
}

export interface VoiceParticipant {
  room_id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  joined_at: string;
  profile?:
    | { username: string; display_name: string | null; avatar_url: string | null }
    | { username: string; display_name: string | null; avatar_url: string | null }[]
    | null;
}

export async function listRoomParticipants(roomId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_room_participants")
    .select(
      `room_id, user_id, role, is_muted, joined_at,
       profile:profiles!voice_room_participants_user_id_fkey ( username, display_name, avatar_url )`,
    )
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });
  return (data as VoiceParticipant[] | null) ?? [];
}

export async function countRoomParticipants(roomId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("voice_room_participants")
    .select("user_id", { count: "exact", head: true })
    .eq("room_id", roomId);
  return count ?? 0;
}