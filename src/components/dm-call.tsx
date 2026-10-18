"use client";

// src/components/dm-call.tsx
// DM voice calls (GAP-MSG-CALL-01) — client call affordance + WebRTC layer.
//
// Lifecycle:
//   idle → caller startCallAction() → ringing (server call_sessions row)
//   callee sees the ringing row via realtime → Accept calls answerCallAction()
//   both sides go active → mic + RTCPeerConnection + webrtc_signals(conversation)
//   caller is the sole offerer; callee answers. ICE candidates buffer until the
//   remote description is set. Hangup/decline/cancel/45s-timeout end the row
//   and the server writes the call-log message (attachment_type='call').
//
// Signaling transport is the same DB table as voice rooms, addressed by
// conversation_id (049). RLS scopes reads/writes to conversation members.
// The service-role key is never used here.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendSignal,
  clearOwnSignals,
  type SignalingMessage,
  type SignalPayload,
} from "@/lib/webrtc-signaling";
import {
  startCallAction,
  answerCallAction,
  declineCallAction,
  cancelCallAction,
  endCallAction,
  timeoutCallAction,
} from "@/lib/messaging/call-actions";
import {
  RING_TIMEOUT_MS,
  formatCallDuration,
  callOutcomeLabel,
} from "@/lib/messaging/call-utils";
import type {
  CallPartner,
  CallSession,
  CallMedia,
} from "@/lib/messaging/call-utils";
import { ICE_SERVERS, HAS_TURN } from "@/lib/ice-servers";

/** Small grace on top of the 45s server-side ring timeout. */
const CLIENT_RING_TIMEOUT_MS = RING_TIMEOUT_MS + 1500;

type MediaState = "idle" | "requesting" | "live" | "denied";

interface DmCallProps {
  conversationId: string;
  currentUserId: string;
  partner: CallPartner;
  initialCall: CallSession | null;
}

export function DmCall({
  conversationId,
  currentUserId,
  partner,
  initialCall,
}: DmCallProps) {
  const supabase = useMemo(() => createClient(), []);
  const partnerId = partner.id;
  const partnerName = partner.display_name ?? partner.username;

  const [call, setCall] = useState<CallSession | null>(initialCall);
  const [mediaState, setMediaState] = useState<MediaState>("idle");
  const [connState, setConnState] = useState<RTCPeerConnectionState>("new");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endedLabel, setEndedLabel] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("0:00");
  const [camOn, setCamOn] = useState(true);
  const [relayInUse, setRelayInUse] = useState(false);
  const [remoteCandidateCount, setRemoteCandidateCount] = useState(0);
  // Set when a remote track actually arrived (i.e. the offer/answer negotiated
  // media). A peer connection can reach "connected" on the data-less ICE
  // association alone — without this the overlay would show Connected while
  // nothing can possibly be heard (the 2026-09-28 two-device report).
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const offeredRef = useRef(false);
  const processedRef = useRef<Set<string>>(new Set());
  const signalsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const startingRef = useRef(false);
  const callRef = useRef<CallSession | null>(initialCall);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server-authoritative timestamp floor for signal replay. The optimistic
  // client-side timestamps (start()/accept()) cannot be trusted as floors:
  // a device clock even slightly ahead of the Postgres clock excludes the
  // OFFER from the replay query and the whole handshake stalls forever —
  // "ringing works, Connecting… never resolves" (2026-10-18 report).
  const replayFloorRef = useRef<string | null>(null);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------
  const teardown = useCallback(async () => {
    startingRef.current = false;
    offeredRef.current = false;
    remoteDescSetRef.current = false;
    pendingIceRef.current = [];
    if (sweepTimerRef.current) {
      clearTimeout(sweepTimerRef.current);
      sweepTimerRef.current = null;
    }
    if (signalsChannelRef.current) {
      try {
        await supabase.removeChannel(signalsChannelRef.current);
      } catch (err) {
        console.warn("removeChannel failed:", err);
      }
      signalsChannelRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    setHasRemoteMedia(false);
    setCamOn(true);
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      pcRef.current.getReceivers().forEach((r) => r.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    // Drop our stale signaling rows so a later call can't replay them.
    try {
      await clearOwnSignals(supabase, { conversationId });
    } catch {
      // Best-effort only.
    }
    processedRef.current = new Set();
    setMuted(false);
    setMediaState("idle");
    setConnState("new");
  }, [supabase, conversationId]);

  // -------------------------------------------------------------------------
  // WebRTC signaling
  // -------------------------------------------------------------------------
  const applyRemoteCandidate = useCallback(async (c: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    // No pc means media has not started yet on this side — queue, never drop.
    // Candidates created by the peer can legitimately arrive before our
    // RTCPeerConnection exists (getUserMedia is still resolving).
    if (!pc) {
      if (pendingIceRef.current.length < 100) pendingIceRef.current.push(c);
      return;
    }
    if (!remoteDescSetRef.current) {
      if (pendingIceRef.current.length < 100) pendingIceRef.current.push(c);
      return;
    }
    try {
      await pc.addIceCandidate(c);
    } catch (err) {
      console.warn("addIceCandidate failed:", err);
    }
  }, []);

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
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

  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || offeredRef.current) return;
    offeredRef.current = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(supabase, {
        conversationId,
        toUser: partnerId,
        type: "OFFER",
        payload: { sdp: offer.sdp, type: "offer" },
      });
    } catch (err) {
      offeredRef.current = false;
      console.error("sendOffer failed:", err);
    }
  }, [supabase, conversationId, partnerId]);

  const handleSignal = useCallback(
    async (msg: SignalingMessage) => {
      if (!msg || msg.from_user === currentUserId) return;
      if (msg.to_user && msg.to_user !== currentUserId) return;
      if (processedRef.current.has(msg.id)) return;
      processedRef.current.add(msg.id);

      const pc = pcRef.current;
      if (!pc) return;

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
            conversationId,
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
          setRemoteCandidateCount((n) => n + 1);
          await applyRemoteCandidate({
            candidate: msg.payload.candidate,
            sdpMid: msg.payload.sdpMid ?? null,
            sdpMLineIndex: msg.payload.sdpMLineIndex ?? null,
          });
        }
      } catch (err) {
        console.error("handleSignal failed:", err);
      }
    },
    [
      currentUserId,
      supabase,
      conversationId,
      flushPendingIce,
      applyRemoteCandidate,
    ],
  );

  const beginCallMedia = useCallback(
    async (session: CallSession) => {
      if (startingRef.current || pcRef.current) return;
      startingRef.current = true;
      processedRef.current = new Set();
      setError(null);
      setMediaState("requesting");

      const wantsVideo = session.media === "video";

      if (!navigator.mediaDevices?.getUserMedia) {
        startingRef.current = false;
        setMediaState("denied");
        setError(
          wantsVideo
            ? "Camera/microphone are unavailable in this browser."
            : "Microphone is unavailable in this browser.",
        );
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          wantsVideo ? { audio: true, video: true } : { audio: true },
        );
      } catch (err) {
        console.error(wantsVideo ? "Camera/mic denied:" : "Microphone denied:", err);
        startingRef.current = false;
        setMediaState("denied");
        setError(
          wantsVideo
            ? "Camera/microphone access was blocked."
            : "Microphone access was blocked.",
        );
        return;
      }
      localStreamRef.current = stream;
      if (wantsVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      remoteDescSetRef.current = false;
      pendingIceRef.current = [];
      offeredRef.current = false;
      setHasRemoteMedia(false);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onconnectionstatechange = () => setConnState(pc.connectionState);
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") setConnState("failed");
        // Once ICE confirms bidirectional connectivity the remote stream is
        // safe to play — unblock autoplay here if the early attempt was
        // rejected before any user gesture registered on this page.
        if (
          (pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed") &&
          remoteAudioRef.current &&
          remoteAudioRef.current.paused
        ) {
          void remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.ontrack = (event) => {
        const remote = event.streams[0];
        if (!remote) return;
        setHasRemoteMedia(true);
        remoteStreamRef.current = remote;
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = remote;
        void remoteAudioRef.current.play().catch(() => {
          // Autoplay can be blocked until a gesture; Accept/End counts.
          // oniceconnectionstatechange retries once ICE confirms media flow.
        });
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
      };
      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        if (event.candidate.type === "relay") {
          setRelayInUse(true);
        }
        const payload: SignalPayload = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        };
        await sendSignal(supabase, {
          conversationId,
          toUser: partnerId,
          type: "ICE_CANDIDATE",
          payload,
        });
      };

      // Subscribe before writing/reading signals so nothing is missed.
      const subscribeWithStatus = async (
        name: string,
      ): Promise<"SUBSCRIBED" | "OTHER"> => {
        const channel = supabase
          .channel(name)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "webrtc_signals",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              void handleSignal(payload.new as unknown as SignalingMessage);
            },
          );
        const status = await new Promise<string>((resolve) => {
          channel.subscribe((s) => {
            if (String(s) === "CHANNEL_REQUEST") return;
            resolve(String(s));
          });
        });
        if (status === "SUBSCRIBED") signalsChannelRef.current = channel;
        return status === "SUBSCRIBED" ? "SUBSCRIBED" : "OTHER";
      };

      const subscribed = await subscribeWithStatus(
        `dm-call:${conversationId}`,
      );
      if (subscribed !== "SUBSCRIBED") {
        // A failed channel previously counted as "ready" — silent signaling
        // loss. Try exactly one reconnect, then proceed so the replay query
        // still runs (the sweep below catches anything the dead channel lost).
        console.warn("dm-call: signaling channel failed, retrying once");
        try {
          if (signalsChannelRef.current) {
            await supabase.removeChannel(signalsChannelRef.current);
          }
        } catch {
          // ignore removal errors on a dead channel
        }
        signalsChannelRef.current = null;
        await new Promise((r) => setTimeout(r, 1200));
        await subscribeWithStatus(`dm-call-reconnect:${conversationId}`);
      }

      // Authoritative replay floor: refetch the session row so the floor is a
      // SERVER clock timestamp. The optimistic client-clock answered_at
      // (accept()/start()) races the Postgres clock and used to exclude the
      // OFFER from callee replay → "Connecting…" forever.
      let authoritative = session;
      if (!session.id.startsWith("pending-")) {
        const { data: fresh } = await supabase
          .from("call_sessions")
          .select("*")
          .eq("id", session.id)
          .maybeSingle();
        if (fresh) {
          authoritative = fresh as unknown as CallSession;
          setCall((prev) =>
            prev && prev.id === authoritative.id
              ? { ...prev, ...authoritative }
              : prev,
          );
        }
      }
      const floor =
        authoritative.answered_at ??
        authoritative.started_at ??
        session.answered_at ??
        session.started_at;
      replayFloorRef.current = floor;

      // Replay signals written after the call went active: the callee can
      // subscribe after the caller's OFFER/ICE already landed in the table.
      const { data } = await supabase
        .from("webrtc_signals")
        .select(
          "id, room_id, conversation_id, from_user, to_user, type, payload, created_at",
        )
        .eq("conversation_id", conversationId)
        .gte("created_at", floor)
        .order("created_at", { ascending: true })
        .limit(120);
      for (const row of (data ?? []) as unknown as SignalingMessage[]) {
        await handleSignal(row);
      }

      setMediaState("live");
      setRemoteCandidateCount(0);

      // Caller is the deterministic offerer; callee waits for the OFFER.
      const isCaller = authoritative.caller_id === currentUserId;
      if (isCaller) {
        await sendOffer();
      }

      // Safety sweep: ~7s later, re-run the replay query. processedRef makes
      // it idempotent, so it only catches signals missed by a dead channel,
      // a skewed floor write, or any pre-subscribe INSERT gap. The caller
      // also gets one re-offer if the callee's ANSWER never arrived — the pc
      // state is unchanged (no remote description yet), so re-offering is
      // safe and un-stalls the negotiation that used to hang forever.
      if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
      sweepTimerRef.current = setTimeout(() => {
        if (!pcRef.current) return;
        const sweepFloor = replayFloorRef.current;
        if (!sweepFloor) return;
        void (async () => {
          try {
            const { data: sweepData } = await supabase
              .from("webrtc_signals")
              .select(
                "id, room_id, conversation_id, from_user, to_user, type, payload, created_at",
              )
              .eq("conversation_id", conversationId)
              .gte("created_at", sweepFloor)
              .order("created_at", { ascending: true })
              .limit(120);
            for (const row of (sweepData ?? []) as unknown as SignalingMessage[]) {
              await handleSignal(row);
            }
            if (
              isCaller &&
              !remoteDescSetRef.current &&
              pcRef.current &&
              offeredRef.current
            ) {
              offeredRef.current = false;
              await sendOffer();
            }
          } catch (err) {
            console.warn("dm-call sweep failed:", err);
          }
        })();
      }, 7000);
    },
    [
      currentUserId,
      supabase,
      conversationId,
      partnerId,
      handleSignal,
      sendOffer,
    ],
  );

  // -------------------------------------------------------------------------
  // Realtime: call_sessions rows
  // -------------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`dm-calls:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as unknown as
            | CallSession
            | undefined;
          if (!row?.id) return;
          setCall(row);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  // Start media exactly once when the call goes active.
  useEffect(() => {
    if (call?.status !== "active") return;
    if (pcRef.current || startingRef.current) return;
    void beginCallMedia(call);
  }, [call, beginCallMedia]);

  // Tear down and surface a short "ended" state. setState is deferred out of
  // the effect body (react-hooks/set-state-in-effect) via a 0ms timer.
  useEffect(() => {
    if (call?.status !== "ended") return;
    const label = call.outcome ? callOutcomeLabel(call.outcome) : "Call ended";
    const teardownTimer = setTimeout(() => {
      void teardown();
      setEndedLabel(label);
    }, 0);
    const clearTimer = setTimeout(() => {
      setCall(null);
      setEndedLabel(null);
    }, 3000);
    return () => {
      clearTimeout(teardownTimer);
      clearTimeout(clearTimer);
    };
  }, [call?.id, call?.status, call?.outcome, teardown]);

  // Client-side ring timeout for the caller (server enforces 45s too).
  useEffect(() => {
    if (call?.status !== "ringing" || call.caller_id !== currentUserId) return;
    const callId = call.id;
    const t = setTimeout(() => {
      const current = callRef.current;
      if (current?.id === callId && current.status === "ringing") {
        void timeoutCallAction(callId, conversationId);
      }
    }, CLIENT_RING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [call?.id, call?.status, call?.caller_id, currentUserId, conversationId]);

  // Duration ticker while connected.
  useEffect(() => {
    if (call?.status !== "active") return;
    const startIso = call.answered_at ?? call.started_at;
    const tick = () =>
      setElapsed(formatCallDuration(startIso, new Date().toISOString()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.status, call?.answered_at, call?.started_at]);

  // Best-effort hangup if the tab is closed/navigated mid-call.
  useEffect(() => {
    const bail = () => {
      const current = callRef.current;
      if (!current) return;
      if (current.status === "ringing" && current.caller_id === currentUserId) {
        void cancelCallAction(current.id, conversationId);
      } else if (current.status === "active") {
        void endCallAction(current.id, conversationId);
      }
    };
    window.addEventListener("pagehide", bail);
    return () => window.removeEventListener("pagehide", bail);
  }, [currentUserId, conversationId]);

  // Unmount cleanup — release the peer, mic and signaling channel.
  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const start = useCallback(async (media: CallMedia = "audio") => {
    setError(null);
    const res = await startCallAction(conversationId, media);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const now = new Date().toISOString();
    setCall({
      id: res.callId ?? `pending-${now}`,
      conversation_id: conversationId,
      caller_id: currentUserId,
      callee_id: partnerId,
      media,
      status: "ringing",
      outcome: null,
      started_at: now,
      answered_at: null,
      ended_at: null,
      ended_by: null,
      created_at: now,
    });
  }, [conversationId, currentUserId, partnerId]);

  const accept = useCallback(async () => {
    if (!call) return;
    setError(null);
    const res = await answerCallAction(call.id, conversationId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Optimistic flip (client clock) purely for instant UI; the authoritative
    // server row overwrites it inside beginCallMedia (floor + duration).
    setCall((prev) =>
      prev && prev.id === call.id
        ? { ...prev, status: "active", answered_at: new Date().toISOString() }
        : prev,
    );
    // Snap to the server row so answered_at is authoritative immediately.
    if (!call.id.startsWith("pending-")) {
      const { data: fresh } = await supabase
        .from("call_sessions")
        .select("*")
        .eq("id", call.id)
        .maybeSingle();
      if (fresh) {
        setCall((prev) =>
          prev && prev.id === call.id ? { ...prev, ...(fresh as CallSession) } : prev,
        );
      }
    }
  }, [call, conversationId, supabase]);

  const decline = useCallback(async () => {
    if (!call) return;
    const res = await declineCallAction(call.id, conversationId);
    if (!res.ok) setError(res.error);
  }, [call, conversationId]);

  const hangup = useCallback(async () => {
    if (!call) return;
    const cancelling = call.status === "ringing" && call.caller_id === currentUserId;
    const res = cancelling
      ? await cancelCallAction(call.id, conversationId)
      : await endCallAction(call.id, conversationId);
    if (!res.ok) setError(res.error);
  }, [call, conversationId, currentUserId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !camOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setCamOn(next);
  }, [camOn]);

  // Video elements mount with the overlay after the media effect runs; attach
  // the already-captured streams on the next commit so previews never miss.
  useEffect(() => {
    if (call?.status !== "active" || call.media !== "video") return;
    const t = setTimeout(() => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }, 0);
    return () => clearTimeout(t);
  }, [call?.id, call?.status, call?.media, mediaState]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!partner) return null;

  const isIncoming =
    call?.status === "ringing" && call.callee_id === currentUserId;
  const isOutgoing =
    call?.status === "ringing" && call.caller_id === currentUserId;
  const isLive = call?.status === "active";
  const isEnded = call?.status === "ended";
  // Media is only real once remote tracks arrived. peerConnectionState can
  // read "connected" with zero m-lines answered — treat that as connecting.
  const isMediaLive =
    isLive && connState === "connected" && hasRemoteMedia;
  const isMediaFailed = isLive && connState === "failed";
  const isMediaConnecting = isLive && !isMediaLive && !isMediaFailed;
  const overlayOpen = Boolean(call);
  const activeMedia: CallMedia = call?.media ?? "audio";

  const statusText =
    isMediaFailed
      ? "Connection failed — check your network"
      : isMediaLive
        ? "Connected"
        : isMediaConnecting && remoteCandidateCount > 0
          ? "Connecting…"
          : mediaState === "requesting"
            ? "Connecting…"
            : mediaState === "denied"
              ? "Microphone unavailable"
              : "Connecting…";

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void start("audio")}
          disabled={Boolean(call)}
          className="press inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-fg hover:bg-surface disabled:opacity-40"
          aria-label={`Call ${partnerName}`}
        >
          <span aria-hidden>📞</span> Call
        </button>
        <button
          type="button"
          onClick={() => void start("video")}
          disabled={Boolean(call)}
          className="press inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-fg hover:bg-surface disabled:opacity-40"
          aria-label={`Video call ${partnerName}`}
        >
          <span aria-hidden>🎥</span> Video
        </button>
      </div>

      {overlayOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activeMedia === "video" ? "Video call" : "Voice call"}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-white">
              {partnerName.charAt(0).toUpperCase()}
            </div>
            <p className="text-base font-bold text-fg">{partnerName}</p>

            {isIncoming && (
              <p className="mt-1 text-sm text-text-secondary">
                Incoming {activeMedia === "video" ? "video" : "voice"} call…
              </p>
            )}
            {isOutgoing && (
              <p className="mt-1 text-sm text-text-secondary">Calling…</p>
            )}
            {isLive && (
              <p className="mt-1 text-sm text-text-secondary">
                {statusText} · {elapsed}
              </p>
            )}
            {isLive && isMediaFailed && (
              <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {relayInUse
                  ? "The relay connection dropped. Try ending and redialling."
                  : !HAS_TURN
                    ? "Calls behind carrier/corporate NAT need a relay — ask the server admin to configure TURN (NEXT_PUBLIC_TURN_URL), then redial."
                    : "Media could not traverse both networks. Try ending and redialling."}
              </p>
            )}
            {isEnded && (
              <p className="mt-1 text-sm text-text-secondary">
                {endedLabel ?? "Call ended"}
              </p>
            )}

            {isLive && activeMedia === "video" && (
              <div className="relative mx-auto mt-3 w-full max-w-[20rem] overflow-hidden rounded-xl border border-border bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-48 w-full object-cover"
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute bottom-2 right-2 h-20 w-28 rounded-lg border border-border object-cover"
                />
                {!camOn && (
                  <p className="absolute bottom-2 right-2 flex h-20 w-28 items-center justify-center rounded-lg bg-black/70 text-[10px] font-semibold text-white">
                    Camera off
                  </p>
                )}
                {!isMediaLive && !isMediaFailed && (
                  <p className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
                    Connecting media…
                  </p>
                )}
                {isMediaFailed && (
                  <p className="absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
                    Media connection failed
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-center gap-2">
              {isIncoming && (
                <>
                  <button
                    type="button"
                    onClick={() => void accept()}
                    className="press inline-flex h-11 items-center rounded-full bg-success px-6 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void decline()}
                    className="press inline-flex h-11 items-center rounded-full bg-red-500 px-6 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    Decline
                  </button>
                </>
              )}

              {(isOutgoing || isLive) && (
                <>
                  {isLive && (
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="press inline-flex h-11 items-center rounded-full border border-border bg-bg px-5 text-sm font-semibold text-fg hover:bg-surface-subtle"
                      aria-label={muted ? "Unmute" : "Mute"}
                    >
                      {muted ? "🔇 Unmute" : "🎙️ Mute"}
                    </button>
                  )}
                  {isLive && activeMedia === "video" && (
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className="press inline-flex h-11 items-center rounded-full border border-border bg-bg px-5 text-sm font-semibold text-fg hover:bg-surface-subtle"
                      aria-label={camOn ? "Turn camera off" : "Turn camera on"}
                    >
                      {camOn ? "📷 Camera off" : "📷 Camera on"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void hangup()}
                    className="press inline-flex h-11 items-center rounded-full bg-red-500 px-6 text-sm font-semibold text-white hover:bg-red-600"
                  >
                    {isOutgoing ? "Cancel" : "End"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
