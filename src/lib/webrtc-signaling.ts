"use client";
// V2 WebRTC Signaling — SDP/ICE transport over webrtc_signals (DB + realtime).
// Phase 0.6: complete signaling transport. Schema (010) is sufficient;
// this layer authenticates the caller via Supabase session and writes rows
// that the receiver observes through the postgres_changes subscription.
//
// Two target modes exist (049): voice rooms address a signal by `room_id`;
// DM calls address it by `conversation_id` (both sides are conversation
// members). Exactly one target is set per row.
//
// Authorization: RLS on webrtc_signals restricts SELECT to room participants
// / conversation members and INSERT to the row's from_user (= auth.uid()).
// Cross-target signaling is blocked by both the SELECT policy and the
// realtime subscription filter. Service-role key is NEVER used here.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalType = "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "PEER_JOIN" | "PEER_LEAVE";

/** A signaling row is addressed either by voice room or by DM conversation. */
export type SignalTarget =
  | { roomId: string; conversationId?: undefined }
  | { roomId?: undefined; conversationId: string };

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
  room_id: string | null;
  conversation_id: string | null;
  from_user: string;
  to_user: string | null;
  type: SignalType;
  payload: SignalPayload;
  created_at: string;
}

/**
 * Persist a signaling message. Server enforces RLS; the row is only readable
 * by room participants / conversation members via the SELECT policy.
 *
 * Pass either `roomId` (voice rooms) or `conversationId` (DM calls) — never
 * both. Exactly one target is written.
 */
export async function sendSignal(
  supabase: SupabaseClient,
  args: SignalTarget & {
    toUser?: string | null;
    type: SignalType;
    payload: SignalPayload;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { toUser = null, type, payload } = args;
  const target =
    args.roomId !== undefined
      ? { room_id: args.roomId, conversation_id: null }
      : { room_id: null, conversation_id: args.conversationId };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.from("webrtc_signals").insert({
    ...target,
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
 * room or conversation. Useful on component unmount or when leaving a
 * session so future participants don't see stale markers.
 *
 * Accepts a bare room id string (legacy call sites) or a SignalTarget.
 */
export async function clearOwnSignals(
  supabase: SupabaseClient,
  target: string | SignalTarget,
): Promise<void> {
  const column =
    typeof target === "string" || target.roomId !== undefined
      ? { key: "room_id", value: typeof target === "string" ? target : target.roomId! }
      : { key: "conversation_id", value: target.conversationId! };
  await supabase.from("webrtc_signals").delete().eq(column.key, column.value);
}

