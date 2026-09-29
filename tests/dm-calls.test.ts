// Deterministic tests for DM voice calls (GAP-MSG-CALL-01).
//
// Covers the pure helpers in the client-safe call-utils module and the RLS /
// RPC authorization contract sourced from the committed migration (049).
// DB-layer paths (starting/answering a real call) run at integration time.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  __test,
  formatCallDuration,
  startCallVerdict,
  describeCallError,
  callOutcomeLabel,
  RING_TIMEOUT_MS,
  type StartCallContext,
} from "@/lib/messaging/call-utils";
import { ICE_SERVERS } from "@/lib/ice-servers";

const { formatCallDuration: _fmt, startCallVerdict: _scv, RING_TIMEOUT_MS: _rt } =
  __test;

const DM_CALLS_SQL = readFileSync(
  join(process.cwd(), "docs/database/049_dm_calls.sql"),
  "utf8",
);

describe("formatCallDuration (mirrors _call_duration_text)", () => {
  it("returns 0:00 before both ends exist", () => {
    expect(formatCallDuration(null, null)).toBe("0:00");
    expect(formatCallDuration("2026-01-01T00:00:00Z", null)).toBe("0:00");
  });

  it("formats minutes and zero-padded seconds", () => {
    const start = "2026-01-01T00:00:00Z";
    expect(formatCallDuration(start, "2026-01-01T00:00:05Z")).toBe("0:05");
    expect(formatCallDuration(start, "2026-01-01T00:00:59Z")).toBe("0:59");
    expect(formatCallDuration(start, "2026-01-01T00:01:00Z")).toBe("1:00");
    expect(formatCallDuration(start, "2026-01-01T00:12:34Z")).toBe("12:34");
  });

  it("never goes negative on clock skew", () => {
    expect(
      formatCallDuration("2026-01-01T00:00:10Z", "2026-01-01T00:00:00Z"),
    ).toBe("0:00");
  });

  it("exports the same value through __test and the ring timeout", () => {
    expect(_fmt).toBe(formatCallDuration);
    expect(_scv).toBe(startCallVerdict);
    expect(_rt).toBe(RING_TIMEOUT_MS);
  });
});

describe("startCallVerdict (pre-flight mirror of start_dm_call)", () => {
  const base: StartCallContext = {
    conversationType: "direct",
    isMember: true,
    memberCount: 2,
    pairBlocked: false,
    activeCallExists: false,
  };

  it("allows a direct, unblocked, non-busy pair", () => {
    expect(startCallVerdict(base)).toBe("ok");
  });

  it("rejects non-direct conversations", () => {
    expect(startCallVerdict({ ...base, conversationType: "group" })).toBe("not_direct");
    expect(startCallVerdict({ ...base, conversationType: null })).toBe("not_direct");
  });

  it("rejects non-members", () => {
    expect(startCallVerdict({ ...base, isMember: false })).toBe("not_member");
  });

  it("rejects conversations that don't have exactly two members", () => {
    expect(startCallVerdict({ ...base, memberCount: 1 })).toBe("not_two_members");
    expect(startCallVerdict({ ...base, memberCount: 3 })).toBe("not_two_members");
  });

  it("rejects blocked pairs", () => {
    expect(startCallVerdict({ ...base, pairBlocked: true })).toBe("blocked");
  });

  it("rejects a pair that already has a call in progress", () => {
    expect(startCallVerdict({ ...base, activeCallExists: true })).toBe("busy");
  });
});

describe("describeCallError", () => {
  it("maps unauthenticated errors by code", () => {
    expect(describeCallError("28000", "whatever")).toBe("Sign in to start a call.");
  });

  it("maps stable RAISE messages to friendly copy", () => {
    expect(describeCallError("22023", "start_dm_call: only direct conversations can be called"))
      .toBe("Calls are only available in direct messages.");
    expect(describeCallError("P0001", "start_dm_call: you cannot call this user"))
      .toBe("You can't call this user.");
    expect(describeCallError("P0001", "start_dm_call: a call is already in progress"))
      .toBe("There's already a call in progress.");
    expect(describeCallError("P0002", "answer_dm_call: no ringing call to answer"))
      .toBe("The call is no longer ringing.");
    expect(describeCallError("P0002", "end_dm_call: no active call to end"))
      .toBe("The call already ended.");
  });

  it("falls back to generic copy for unknown errors", () => {
    expect(describeCallError("XX000", "boom")).toBe(
      "The call couldn't be completed. Please try again.",
    );
  });
});

describe("callOutcomeLabel", () => {
  it("labels each terminal outcome", () => {
    expect(callOutcomeLabel("MISSED")).toBe("Missed voice call");
    expect(callOutcomeLabel("DECLINED")).toBe("Voice call declined");
    expect(callOutcomeLabel("CANCELLED")).toBe("Voice call cancelled");
    expect(callOutcomeLabel("COMPLETED")).toBe("Voice call completed");
    expect(callOutcomeLabel(null)).toBe("Voice call ended");
  });
});

describe("DM call authorization contract (migration 049)", () => {
  it("only direct conversations can be called", () => {
    expect(DM_CALLS_SQL).toMatch(/only direct conversations can be called/i);
  });

  it("requires an active member and exactly two members", () => {
    expect(DM_CALLS_SQL).toMatch(/not an active member/i);
    expect(DM_CALLS_SQL).toMatch(/needs two active members/i);
  });

  it("blocks calls between blocked pairs", () => {
    expect(DM_CALLS_SQL).toMatch(/_call_pair_blocked/);
    expect(DM_CALLS_SQL).toMatch(/cannot call this user/i);
  });

  it("allows one concurrent call per pair", () => {
    expect(DM_CALLS_SQL).toMatch(/already in progress/i);
  });

  it("times out ringing calls after 45 seconds", () => {
    expect(DM_CALLS_SQL).toMatch(/interval '45 seconds'/i);
  });

  it("logs calls as messages.attachment_type='call' written by the RPC", () => {
    expect(DM_CALLS_SQL).toMatch(/'call'/);
    expect(DM_CALLS_SQL).toMatch(/_log_call_event/);
  });

  it("addresses signaling by conversation_id and scopes it to members", () => {
    expect(DM_CALLS_SQL).toMatch(/conversation_id/);
    expect(DM_CALLS_SQL).toMatch(/conversation_members/);
  });

  it("never grants anon EXECUTE on the call RPCs", () => {
    expect(DM_CALLS_SQL).toMatch(/REVOKE (ALL|EXECUTE)[\s\S]*?\bANON\b/i);
  });
});

describe("ICE configuration (GAP-WEBRTC-01 two-peer media)", () => {
  const DM_CALL_TSX = readFileSync(
    join(process.cwd(), "src/components/dm-call.tsx"),
    "utf8",
  );
  const VOICE_PEER_TSX = readFileSync(
    join(process.cwd(), "src/components/webrtc-peer.tsx"),
    "utf8",
  );
  const ICE_SERVERS_TS = readFileSync(
    join(process.cwd(), "src/lib/ice-servers.ts"),
    "utf8",
  );

  it("always advertises at least one STUN server", () => {
    expect(ICE_SERVERS.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(ICE_SERVERS)).toMatch(/stun:/);
  });

  it("is the single shared config both call surfaces use", () => {
    expect(DM_CALL_TSX).toContain('from "@/lib/ice-servers"');
    expect(VOICE_PEER_TSX).toContain('from "@/lib/ice-servers"');
    // Neither surface may drift back to an inline STUN-only list — that is
    // exactly how two-peer media broke behind symmetric NAT / CGNAT.
    expect(DM_CALL_TSX).not.toMatch(/stun:stun\.l\.google\.com/);
    expect(VOICE_PEER_TSX).not.toMatch(/stun:stun\.l\.google\.com/);
  });

  it("activates TURN only with a complete URL+username+credential triple", () => {
    expect(ICE_SERVERS_TS).toMatch(/NEXT_PUBLIC_TURN_URL/);
    expect(ICE_SERVERS_TS).toMatch(/NEXT_PUBLIC_TURN_USERNAME/);
    expect(ICE_SERVERS_TS).toMatch(/NEXT_PUBLIC_TURN_CREDENTIAL/);
    // Partial config must degrade to STUN, never emit a broken RTCIceServer.
    expect(ICE_SERVERS_TS).toMatch(/TURN disabled/);
  });

  it("derives media liveness from remote tracks, not peer state alone", () => {
    // peerConnectionState can read "connected" with zero media negotiated;
    // the overlay must gate "Connected" on an actual ontrack event.
    expect(DM_CALL_TSX).toMatch(/hasRemoteMedia/);
    expect(DM_CALL_TSX).toMatch(/ontrack/);
    expect(DM_CALL_TSX).toMatch(/isMediaLive/);
  });

  it("documents the TURN variables and their credential boundary", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(envExample).toContain("NEXT_PUBLIC_TURN_URL=");
    expect(envExample).toContain("NEXT_PUBLIC_TURN_USERNAME=");
    expect(envExample).toContain("NEXT_PUBLIC_TURN_CREDENTIAL=");
    expect(envExample).toMatch(/short-lived/i);
  });
});
