"use client";
// VoiceRoomView — live room client view.
// 1. Join the room (voice_room_participants upsert) on mount.
// 2. Request mic via getUserMedia and attach it to a WebRTC peer
//    (useWebRTCPeer) so audio is actually transported via STUN.
// 3. Live participant list via realtime; mute/leave controls.
//
// The meeting/voice is 1-to-1 mesh-capable: the first joiner dials and
// receivers answer through the webrtc_signals table (010/011).

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWebRTCPeer } from "@/components/webrtc-peer";
import { joinVoiceRoom, leaveVoiceRoom } from "@/lib/voice/actions";
import type { VoiceParticipant } from "@/lib/voice/queries";

interface Props {
  roomId: string;
  communitySlug: string;
  currentUserId: string;
  initialParticipants: VoiceParticipant[];
}

export function VoiceRoomView({
  roomId,
  communitySlug,
  currentUserId,
  initialParticipants,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [participants, setParticipants] = useState<VoiceParticipant[]>(initialParticipants);
  const [mediaState, setMediaState] = useState<"idle" | "requesting" | "connecting" | "live" | "denied">("idle");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Primary peer — dialer = the current user (first joiner acts as host).
  const { state, initPeer, closePeer, setMuted } = useWebRTCPeer(roomId, {
    supabase,
  });

  const mediaStreamRef = useRef<MediaStream | null>(null);

  const refreshParticipants = useCallback(async () => {
    const { data } = await supabase
      .from("voice_room_participants")
      .select(
        `room_id, user_id, role, is_muted, joined_at,
         profile:profiles!voice_room_participants_user_id_fkey ( username, display_name, avatar_url )`,
      )
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (data) setParticipants(data as VoiceParticipant[]);
  }, [supabase, roomId]);

  const joinRoom = useCallback(() => {
    startTransition(async () => {
      const res = await joinVoiceRoom(roomId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setJoined(true);
      refreshParticipants();
    });
  }, [roomId, refreshParticipants]);

  const startMicrophone = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaState("denied");
      return;
    }
    setMediaState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMediaState("connecting");
      await initPeer(stream);
      setMediaState("live");
    } catch (err) {
      console.error("Mic access denied:", err);
      setMediaState("denied");
    }
  }, [initPeer]);

  const leave = useCallback(() => {
    startTransition(async () => {
      await leaveVoiceRoom(roomId);
      await closePeer();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      router.push(`/communities/${communitySlug}/voice`);
    });
  }, [roomId, closePeer, communitySlug, router]);

  // Join automatically once, then subscribe to participants + presence.
  useEffect(() => {
    if (!joined) joinRoom();
    const channel = supabase
      .channel(`voice-participants:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_room_participants",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshParticipants(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, roomId, supabase, refreshParticipants]);

  // Keep joinRoom err state tidy while room auto-joins.
  const connected = state.connectionState === "connected";
  const connLabel =
    mediaState === "live"
      ? connected
        ? "Connected"
        : "Waiting for peers…"
      : mediaState === "denied"
        ? "Mic unavailable"
        : mediaState === "requesting"
          ? "Requesting mic…"
          : "Standby";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                mediaState === "live" && connected ? "bg-success" : "bg-text-muted"
              }`}
            />
            <span className="text-sm font-semibold text-fg">{connLabel}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMuted(!state.isMuted)}
              disabled={mediaState !== "live" && mediaState !== "connecting"}
              className="press inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
              aria-label={state.isMuted ? "Unmute" : "Mute"}
            >
              {state.isMuted ? "Unmute" : "Mute"}
              {state.isMuted ? " 🔇" : " 🎙️"}
            </button>
            <button
              type="button"
              onClick={() => void startMicrophone()}
              disabled={mediaState === "requesting" || mediaState === "live" || mediaState === "connecting"}
              className="press inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-bg px-4 text-xs font-semibold text-fg hover:bg-surface disabled:opacity-40"
            >
              Go Live
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              className="press inline-flex h-10 items-center rounded-md border border-red-500/30 bg-red-500/10 px-4 text-xs font-semibold text-red-500 hover:bg-red-500/20"
            >
              Leave
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </p>
        )}

        <p className="text-xs text-text-muted">
          {mediaState === "idle" || mediaState === "requesting"
            ? "Tap Go Live to connect your microphone. Voice is transported peer-to-peer — no server stores your audio."
            : mediaState === "denied"
              ? "Microphone access was blocked. Allow mic permissions and refresh to speak."
              : connected
                ? `Audio link active with ${participants.length} participant${participants.length === 1 ? "" : "s"}.`
                : "Offer sent — waiting for other participants to answer. Audio will connect automatically."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-fg">
          In the room ({participants.length})
        </h2>
        <ul className="space-y-2">
          {participants.map((p) => {
            const isMe = p.user_id === currentUserId;
            const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
            return (
              <li
                key={p.user_id}
                className="flex items-center gap-2 text-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-xs font-bold text-fg">
                  {profile?.display_name?.[0]?.toUpperCase() ??
                    profile?.username?.[0]?.toUpperCase() ??
                    "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-fg">
                    {profile?.username ?? "Member"}
                  </span>
                  {isMe && <span className="ml-1 text-xs text-text-muted">(you)</span>}
                  <span className="mx-1 text-xs text-text-muted">· {p.role}</span>
                </div>
                {p.role === "moderator" && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent text-[10px] text-white" title="Moderator">
                    ★
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}