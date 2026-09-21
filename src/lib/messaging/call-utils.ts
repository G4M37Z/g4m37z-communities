// ============================================================================
// src/lib/messaging/call-utils.ts
// Client-safe pure helpers, constants and types for DM voice calls.
//
// This module MUST NOT import anything server-only (no next/headers, no
// server Supabase client) because the browser call UI imports it. The server
// service (calls.ts) imports and re-uses these helpers.
// ============================================================================

/** Mirrors the SQL ring timeout in timeout_dm_call (45 seconds). */
export const RING_TIMEOUT_MS = 45_000;

export type CallStatus = "ringing" | "active" | "ended";
export type CallOutcome =
  | "COMPLETED"
  | "CALLER_HANGUP"
  | "CALLEE_HANGUP"
  | "MISSED"
  | "DECLINED"
  | "CANCELLED";
export type CallMedia = "audio" | "video";

export interface CallSession {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  media: CallMedia;
  status: CallStatus;
  outcome: CallOutcome | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  created_at: string;
}

export interface CallPartner {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CallContext {
  /** Direct conversations are the only ones that can be called. */
  isDirect: boolean;
  /** The other member of a direct conversation (null for group/none). */
  partner: CallPartner | null;
  /** The ringing/active call for this conversation, if any. */
  activeCall: CallSession | null;
}

/**
 * Mirrors public._call_duration_text: "m:ss" (or "0:00" before either end).
 * Kept client-side so the call UI can tick without a round trip.
 */
export function formatCallDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string {
  if (!startedAt || !endedAt) return "0:00";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "0:00";
  const secs = Math.max(0, Math.floor((end - start) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export interface StartCallContext {
  conversationType: string | null;
  isMember: boolean;
  memberCount: number;
  pairBlocked: boolean;
  activeCallExists: boolean;
}

export type StartCallVerdict =
  | "not_direct"
  | "not_member"
  | "not_two_members"
  | "blocked"
  | "busy"
  | "ok";

/**
 * Client-side pre-flight mirror of start_dm_call's guards. The server RPC is
 * authoritative; this only lets the UI disable the button and explain why
 * without a failed round trip.
 */
export function startCallVerdict(ctx: StartCallContext): StartCallVerdict {
  if (ctx.conversationType !== "direct") return "not_direct";
  if (!ctx.isMember) return "not_member";
  if (ctx.memberCount !== 2) return "not_two_members";
  if (ctx.pairBlocked) return "blocked";
  if (ctx.activeCallExists) return "busy";
  return "ok";
}

/**
 * Maps a Postgres RPC error (code + message) to a user-facing sentence. The
 * RAISE messages in the call RPCs are stable, so a substring match is enough;
 * unauthenticated callers are normalised across every RPC.
 */
export function describeCallError(
  code: string | null | undefined,
  message: string,
): string {
  const m = message.toLowerCase();
  if (m.includes("not authenticated") || code === "28000") {
    return "Sign in to start a call.";
  }
  if (m.includes("only direct conversations")) {
    return "Calls are only available in direct messages.";
  }
  if (m.includes("conversation not found")) {
    return "This conversation no longer exists.";
  }
  if (m.includes("not an active member")) {
    return "You're not a member of this conversation.";
  }
  if (m.includes("needs two active members")) {
    return "This conversation can't be called.";
  }
  if (m.includes("cannot call this user")) {
    return "You can't call this user.";
  }
  if (m.includes("already in progress")) {
    return "There's already a call in progress.";
  }
  if (m.includes("no ringing call")) {
    return "The call is no longer ringing.";
  }
  if (m.includes("no expired ringing call")) {
    return "The call already ended.";
  }
  if (m.includes("no active call")) {
    return "The call already ended.";
  }
  return "The call couldn't be completed. Please try again.";
}

/** Human label for a completed-call log row (messages.attachment_type='call'). */
export function callOutcomeLabel(outcome: CallOutcome | null): string {
  switch (outcome) {
    case "MISSED":
      return "Missed voice call";
    case "DECLINED":
      return "Voice call declined";
    case "CANCELLED":
      return "Voice call cancelled";
    case "COMPLETED":
      return "Voice call completed";
    default:
      return "Voice call ended";
  }
}

export const __test = {
  formatCallDuration,
  startCallVerdict,
  describeCallError,
  callOutcomeLabel,
  RING_TIMEOUT_MS,
};
