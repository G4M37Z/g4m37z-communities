"use client";
// V2 WebRTC Signaling Foundation — verified (media transport separate)
// Uses existing DB: reactions, emoji_usage, gif_refs, voice_comments, voice_rooms, voice_room_settings, voice_room_participants, storage.bucket (voice-recordings)
// No getUserMedia or RTCPeerConnection media stream implemented (verified missing — no fabricated transport)
// This layer: signaling/state only (per V2 master spec §11: separate signaling/state from media transport)

export interface VoiceSignalingState {
  roomId: string;
  participantId: string;
  userId: string;
  state: "connecting" | "connected" | "disconnected" | "failed" | "reconnecting";
  isMuted: boolean;
  isSpeaking: boolean;
  timestamp: string;
}
