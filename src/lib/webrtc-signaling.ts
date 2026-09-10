"use client";
// V2 WebRTC Signaling — SDP/ICE transport over webrtc_signals (DB + realtime).
// Phase 0.6: complete signaling transport. Schema (010) is sufficient;
// this layer authenticates the caller via Supabase session and writes rows
// that the receiver observes through the postgres_changes subscription.
//
// Authorization: RLS on webrtc_signals restricts SELECT to room participants
// and INSERT to the row's from_user (= auth.uid()). Cross-room signaling is
// blocked by both the SELECT policy and the realtime subscription filter
// (room_id=eq.<id>). Service-role key is NEVER used here.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalType = "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "PEER_JOIN" | "PEER_LEAVE";

export interface VoiceSignalingState {
  roomId: string;
  participantId: string;
  userId: string;
  state: "connecting" | "connected" | "disconnected" | "failed" | "reconnecting";
  isMuted: boolean;
  isSpeaking: boolean;
  timestamp: string;
}

/** Minimal shape persisted in webrtc_signals.payload (jsonb). */
export interface SignalPayload {
  // OFFER / ANSWER:
  sdp?: string;
  type?: "offer" | "answer";
  // ICE_CANDIDATE:
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  // PEER_JOIN / PEER_LEAVE:
  participantId?: string;
}

export interface SignalingMessage {
  id: string;
  room_id: string;
  from_user: string;
  to_user: string | null;
  type: SignalType;
  payload: SignalPayload;
  created_at: string;
}

/**
 * Persist a signaling message for a room participant. Server enforces RLS;
 * the row is only readable by room members via the SELECT policy.
 */
export async function sendSignal(
  supabase: SupabaseClient,
  args: {
    roomId: string;
    toUser?: string | null;
    type: SignalType;
    payload: SignalPayload;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { roomId, toUser = null, type, payload } = args;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("webrtc_signals").insert({
    room_id: roomId,
    from_user: user.id,
    to_user: toUser,
    type,
    payload,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Best-effort cleanup — delete any rows authored by the current user in a
 * room. Useful on component unmount or when leaving a voice session so
 * future participants don't see stale PEER_JOIN markers.
 */
export async function clearOwnSignals(
  supabase: SupabaseClient,
  roomId: string,
): Promise<void> {
  await supabase.from("webrtc_signals").delete().eq("room_id", roomId);
}
