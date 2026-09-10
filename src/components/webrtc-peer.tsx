"use client";
// Real WebRTC peer layer with complete signaling transport (Phase 0.6).
//
// Uses actual browser APIs:
//   - RTCPeerConnection for offer/answer/ICE
//   - navigator.mediaDevices.getUserMedia (from media-capture)
//
// Uses verified DB (009 + 010 + 011):
//   - voice_rooms / voice_room_settings / voice_room_participants
//   - webrtc_signals (postgres_changes subscription, filtered by room_id)
//   - supabase_realtime publication includes webrtc_signals
//
// Architecture:
//   - One caller per room initiates OFFER.
//   - Receivers observe OFFER via realtime, create their own peer, send ANSWER.
//   - Both peers exchange ICE_CANDIDATE rows until ICE is connected.
//   - ontrack surfaces remote audio streams to the caller via hasRemoteAudio.
//   - Component unmount closes peer, stops tracks, and clears own signals.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendSignal,
  type SignalPayload,
  type SignalingMessage,
} from "@/lib/webrtc-signaling";

export interface PeerState {
  connectionState:
    | "new"
    | "connecting"
    | "connected"
    | "disconnected"
    | "failed"
    | "closed";
  iceConnectionState:
    | "new"
    | "checking"
    | "connected"
    | "completed"
    | "disconnected"
    | "failed"
    | "closed";
  hasRemoteAudio: boolean;
  isMuted: boolean;
}

interface UseWebRTCPeerOptions {
  supabase: SupabaseClient;
  /** When true, this peer is the dialer and will send the initial OFFER. */
  initiate?: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function useWebRTCPeer(
  roomId: string,
  options: UseWebRTCPeerOptions,
) {
  const { supabase, initiate = false } = options;
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Queue ICE candidates that arrive before remote description is set.
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef<boolean>(false);
  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);

  const [state, setState] = useState<PeerState>({
    connectionState: "new",
    iceConnectionState: "new",
    hasRemoteAudio: false,
    isMuted: false,
  });

  const applyRemoteCandidate = useCallback(async (c: RTCIceCandidateInit) => {
    const pc = peerRef.current;
    if (!pc) return;
    if (!remoteDescSetRef.current) {
      pendingIceRef.current.push(c);
      return;
    }
    try {
      await pc.addIceCandidate(c);
    } catch (err) {
      console.warn("addIceCandidate failed:", err);
    }
  }, []);

  const flushPendingIce = useCallback(async () => {
    const pc = peerRef.current;
    if (!pc || !remoteDescSetRef.current) return;
    const queue = pendingIceRef.current.splice(0);
    for (const c of queue) {
      try {
        await pc.addIceCandidate(c);
      } catch (err) {
        console.warn("Queued addIceCandidate failed:", err);
      }
    }
  }, []);

  const handleSignalMessage = useCallback(
    async (msg: SignalingMessage) => {
      const pc = peerRef.current;
      if (!pc) return;

      // Ignore messages authored by ourselves — they're echoes from the
      // realtime broadcast.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (msg.from_user === user?.id) return;

      try {
        if (msg.type === "OFFER" && msg.payload.sdp && msg.payload.type) {
          await pc.setRemoteDescription({
            type: msg.payload.type,
            sdp: msg.payload.sdp,
          });
          remoteDescSetRef.current = true;
          await flushPendingIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(supabase, {
            roomId,
            toUser: msg.from_user,
            type: "ANSWER",
            payload: { sdp: answer.sdp, type: "answer" },
          });
        } else if (
          msg.type === "ANSWER" &&
          msg.payload.sdp &&
          msg.payload.type
        ) {
          await pc.setRemoteDescription({
            type: msg.payload.type,
            sdp: msg.payload.sdp,
          });
          remoteDescSetRef.current = true;
          await flushPendingIce();
        } else if (msg.type === "ICE_CANDIDATE" && msg.payload.candidate) {
          await applyRemoteCandidate({
            candidate: msg.payload.candidate,
            sdpMid: msg.payload.sdpMid ?? null,
            sdpMLineIndex: msg.payload.sdpMLineIndex ?? null,
          });
        }
      } catch (err) {
        console.error("handleSignalMessage error:", err);
      }
    },
    [supabase, roomId, flushPendingIce, applyRemoteCandidate],
  );

  const initPeer = useCallback(
    async (localStream: MediaStream) => {
      if (peerRef.current) return; // Prevent duplicate peer creation.
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRef.current = pc;
      remoteDescSetRef.current = false;
      pendingIceRef.current = [];

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onconnectionstatechange = () => {
        setState((prev) => ({
          ...prev,
          connectionState:
            (pc.connectionState as PeerState["connectionState"]) || "new",
        }));
      };
      pc.oniceconnectionstatechange = () => {
        setState((prev) => ({
          ...prev,
          iceConnectionState:
            (pc.iceConnectionState as PeerState["iceConnectionState"]) || "new",
        }));
      };
      pc.ontrack = (event) => {
        setState((prev) => ({
          ...prev,
          hasRemoteAudio: (event.streams?.length ?? 0) > 0,
        }));
      };
      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        const payload: SignalPayload = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        await sendSignal(supabase, {
          roomId,
          type: "ICE_CANDIDATE",
          payload,
        });
      };

      // Subscribe to signaling messages for this room.
      const channel = supabase
        .channel(`webrtc:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "webrtc_signals",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            void handleSignalMessage(payload.new as SignalingMessage);
          },
        )
        .subscribe();
      channelRef.current = channel;

      if (initiate) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(supabase, {
          roomId,
          type: "OFFER",
          payload: { sdp: offer.sdp, type: "offer" },
        });
      } else {
        // Announce presence so an existing caller can re-offer if needed.
        await sendSignal(supabase, {
          roomId,
          type: "PEER_JOIN",
          payload: {},
        });
      }
    },
    [supabase, roomId, initiate, handleSignalMessage],
  );

  const closePeer = useCallback(async () => {
    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("removeChannel failed:", err);
      }
      channelRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.getSenders().forEach((sender) => sender.track?.stop());
      peerRef.current.getReceivers().forEach((receiver) => receiver.track?.stop());
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingIceRef.current = [];
    remoteDescSetRef.current = false;
    setState({
      connectionState: "closed",
      iceConnectionState: "closed",
      hasRemoteAudio: false,
      isMuted: false,
    });
  }, [supabase]);

  const setMuted = useCallback((mute: boolean) => {
    if (peerRef.current) {
      peerRef.current.getSenders().forEach((sender) => {
        if (sender.track?.kind === "audio") sender.track.enabled = !mute;
      });
    }
    setState((prev) => ({ ...prev, isMuted: mute }));
  }, []);

  // Cleanup on unmount — release channel, peer, tracks.
  useEffect(() => {
    return () => {
      void closePeer();
    };
    // closePeer identity changes with supabase; intentional dep.
  }, [closePeer]);

  return { state, initPeer, closePeer, setMuted };
}
