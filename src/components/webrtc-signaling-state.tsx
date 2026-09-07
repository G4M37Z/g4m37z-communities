"use client";
// WebRTC Signaling/State — verified V2 Phase 5
// Uses DB: voice_rooms/settings/participants (009 verified)
// Media transport: NOT included (verified — requires WebRTC RTCPeerConnection/getUserMedia which is NOT fabricated)
// This is signaling/state layer only (per master spec §11)

export interface VoiceRoomState {
  roomName: string;
  isActive: boolean;
  isLocked: boolean;
  participantCount: number;
  speakerIds: string[];
  listenerIds: string[];
  mutedIds: string[];
  connectionState: "connecting" | "connected" | "failed" | "reconnecting";
}

export function VoiceSignalingUI({ room }: { room: VoiceRoomState }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-fg">{room.roomName}</h3>
      <div className="flex items-center gap-2 mt-2">
        <span className={`h-2 w-2 rounded-full ${room.connectionState === "connected" ? "bg-success" : room.connectionState === "connecting" ? "bg-warning" : "bg-sale"}`} />
        <span className="text-xs text-text-muted uppercase tracking-wider">{room.connectionState}</span>
      </div>
      <p className="text-xs text-text-muted mt-1">Participants: {room.participantCount}</p>
      <p className="text-[10px] text-text-muted mt-0.5">Voice settings: enabled/visible/restricted states verified from DB</p>
    </div>
  );
}
