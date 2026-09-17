"use client";
// Real WebRTC peer layer with complete signaling transport.
//
// Uses actual browser APIs:
//   - RTCPeerConnection for offer/answer/ICE
//   - navigator.mediaDevices.getUserMedia (from the voice room view)
//
// Uses the DB signaling transport (009 + 010 + 011):
//   - webrtc_signals (postgres_changes subscription, filtered by room_id)
//   - supabase_realtime publication includes webrtc_signals
//
// Handshake (no fixed dialer): a peer that goes live announces PEER_JOIN.
// On receipt, the peer with the lexicographically smaller user id sends the
// OFFER; the other acknowledges with a directed PEER_JOIN so the offerer can
// learn about an already-live peer. One peer connection is maintained per hook
// instance (1:1), which matches the room UI.
//
// The realtime subscription is awaited (SUBSCRIBED) before any signaling row
// is written, so an ANSWER/ICE can never arrive before the channel is live.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearOwnSignals,
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
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function useWebRTCPeer(
  roomId: string,
  options: UseWebRTCPeerOptions,
) {
  const { supabase } = options;
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  // Queue ICE candidates that arrive before remote description is set.
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef<boolean>(false);
  // Peers we have already sent an OFFER to (prevents glare / duplicates).
  const offeredToRef = useRef<Set<string>>(new Set());
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

  const sendOffer = useCallback(
    async (toUser: string) => {
      const pc = peerRef.current;
      if (!pc || offeredToRef.current.has(toUser)) return;
      offeredToRef.current.add(toUser);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(supabase, {
          roomId,
          toUser,
          type: "OFFER",
          payload: { sdp: offer.sdp, type: "offer" },
        });
      } catch (err) {
        offeredToRef.current.delete(toUser);
        console.error("sendOffer failed:", err);
      }
    },
    [supabase, roomId],
  );

  const handleSignalMessage = useCallback(
    async (msg: SignalingMessage) => {
      // Ignore our own echoes and messages addressed to someone else.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || msg.from_user === user.id) return;
      if (msg.to_user && msg.to_user !== user.id) return;

      const pc = peerRef.current;
      if (!pc) return; // Not live yet — signaling starts after Go Live.

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
        } else if (msg.type === "PEER_JOIN") {
          // Deterministic dialer: the smaller user id offers. The other
          // acknowledges so the offerer learns about an already-live peer.
          if (user.id < msg.from_user) {
            await sendOffer(msg.from_user);
          } else {
            await sendSignal(supabase, {
              roomId,
              toUser: msg.from_user,
              type: "PEER_JOIN",
              payload: {},
            });
          }
        } else if (msg.type === "PEER_LEAVE") {
          setState((prev) => ({ ...prev, connectionState: "disconnected" }));
        }
      } catch (err) {
        console.error("handleSignalMessage error:", err);
      }
    },
    [supabase, roomId, flushPendingIce, applyRemoteCandidate, sendOffer],
  );

  const initPeer = useCallback(
    async (localStream: MediaStream) => {
      if (peerRef.current) return; // Prevent duplicate peer creation.
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRef.current = pc;
      remoteDescSetRef.current = false;
      pendingIceRef.current = [];
      offeredToRef.current = new Set();

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
        const stream = event.streams[0];
        if (!stream) return;
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = stream;
        void remoteAudioRef.current.play().catch(() => {
          // Autoplay can be blocked until a gesture; the Go Live click
          // satisfies that in practice. Leave the stream attached so the
          // next play() attempt succeeds.
        });
        setState((prev) => ({ ...prev, hasRemoteAudio: true }));
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

      // Subscribe BEFORE writing any signal row, so the peer's ANSWER/ICE
      // cannot arrive before this channel is listening.
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
        );

      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (
            status === "SUBSCRIBED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            resolve();
          }
        });
      });
      channelRef.current = channel;

      // Announce presence; the deterministic rule above decides who offers.
      await sendSignal(supabase, {
        roomId,
        type: "PEER_JOIN",
        payload: {},
      });
    },
    [supabase, roomId, handleSignalMessage],
  );

  const closePeer = useCallback(async () => {
    // Drop stale signaling rows first, then leave a PEER_LEAVE marker (the
    // clear would otherwise delete the marker we just wrote). Leaving is
    // best-effort and must never block teardown.
    await clearOwnSignals(supabase, roomId);
    try {
      await sendSignal(supabase, {
        roomId,
        type: "PEER_LEAVE",
        payload: {},
      });
    } catch {
      // Ignore — the peer connection teardown below is what matters.
    }

    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn("removeChannel failed:", err);
      }
      channelRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
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
    offeredToRef.current = new Set();
    setState({
      connectionState: "closed",
      iceConnectionState: "closed",
      hasRemoteAudio: false,
      isMuted: false,
    });
  }, [supabase, roomId]);

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
  }, [closePeer]);

  return { state, initPeer, closePeer, setMuted };
}
