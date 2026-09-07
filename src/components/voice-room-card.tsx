"use client";
// V2 Community Voice Room — basic presence/state (not media transport)
// Uses existing DB schema (voice_rooms, voice_room_participants, voice_room_settings)

import { useState } from "react";

interface VoiceRoomCardProps {
  roomName: string;
  communityName: string;
  participantCount?: number;
}

export function VoiceRoomCard({ roomName, communityName, participantCount = 0 }: VoiceRoomCardProps) {
  const [muted, setMuted] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">{roomName}</h3>
        <span className="text-xs text-text-muted">{communityName}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
        <span>{participantCount} participant{participantCount === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>Speaking</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="press inline-flex h-9 items-center gap-1 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className="press inline-flex h-9 items-center gap-1 rounded-md border border-border bg-bg px-3 text-xs text-fg hover:bg-surface"
          aria-label="Leave room"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
