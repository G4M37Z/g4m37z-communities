// Deterministic unit tests for the WebRTC signaling payload contract.
// These do NOT exercise real RTCPeerConnection (browser-only) — they verify
// the wire shape that travels over the webrtc_signals table.

import { describe, it, expect } from "vitest";
import type { SignalPayload, SignalingMessage } from "@/lib/webrtc-signaling";

describe("SignalingMessage / SignalPayload", () => {
  it("carries SDP for OFFER", () => {
    const msg: Pick<SignalingMessage, "type" | "payload"> = {
      type: "OFFER",
      payload: { sdp: "v=0\r\no=- ...", type: "offer" } as SignalPayload,
    };
    expect(msg.payload.sdp).toContain("v=0");
    expect(msg.payload.type).toBe("offer");
  });

  it("carries SDP for ANSWER", () => {
    const msg: Pick<SignalingMessage, "type" | "payload"> = {
      type: "ANSWER",
      payload: { sdp: "v=0\r\no=- ...", type: "answer" } as SignalPayload,
    };
    expect(msg.payload.type).toBe("answer");
  });

  it("carries candidate fields for ICE_CANDIDATE", () => {
    const payload: SignalPayload = {
      candidate: "candidate:1 1 udp 2122260223 192.0.2.1 12345 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };
    expect(payload.candidate).toMatch(/^candidate:/);
    expect(payload.sdpMLineIndex).toBe(0);
  });

  it("ICE payload allows null sdp fields", () => {
    const payload: SignalPayload = {
      candidate: "candidate:...",
      sdpMid: null,
      sdpMLineIndex: null,
    };
    expect(payload.sdpMid).toBeNull();
  });

  it("PEER_JOIN / PEER_LEAVE carry no media payload", () => {
    const join: SignalPayload = {};
    const leave: SignalPayload = {};
    expect(join).not.toHaveProperty("sdp");
    expect(leave).not.toHaveProperty("candidate");
  });
});
