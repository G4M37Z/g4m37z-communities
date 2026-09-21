// ============================================================================
// src/lib/messaging/calls.ts
// DM voice calls (GAP-MSG-CALL-01) — server service over the live call RPCs.
//
// Security model:
//   - Every RPC is SECURITY DEFINER and resolves the caller from auth.uid()
//     server-side; the client never supplies caller_id/callee_id and cannot
//     forge a call. RLS scopes calls to conversation members.
//   - start_dm_call enforces: direct conversation only, exactly two members,
//     the caller is a member, the pair is not blocked, and no call is already
//     in progress for either participant.
//   - Signaling uses the webrtc_signals table addressed by conversation_id
//     (049); RLS restricts both reads and writes to conversation members.
//   - Pure helpers live in the client-safe call-utils module and are
//     unit-tested in tests/dm-calls.test.ts.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import {
  describeCallError,
  type CallContext,
  type CallPartner,
  type CallSession,
} from "@/lib/messaging/call-utils";

export type {
  CallStatus,
  CallOutcome,
  CallMedia,
  CallSession,
  CallPartner,
  CallContext,
} from "@/lib/messaging/call-utils";
export { RING_TIMEOUT_MS } from "@/lib/messaging/call-utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CallActionResult =
  | { ok: true; callId: string | null }
  | { ok: false; error: string };

const CALL_COLUMNS =
  "id, conversation_id, caller_id, callee_id, media, status, outcome, started_at, answered_at, ended_at, ended_by, created_at";

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// ---------------------------------------------------------------------------
// Reads (RLS: conversation members only)
// ---------------------------------------------------------------------------

export async function getCallSession(callId: string): Promise<CallSession | null> {
  if (!isUuid(callId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("call_sessions")
    .select(CALL_COLUMNS)
    .eq("id", callId)
    .maybeSingle();
  return (data as CallSession | null) ?? null;
}

/** The current ringing/active call for a conversation, if any. */
export async function getActiveCall(
  conversationId: string,
): Promise<CallSession | null> {
  if (!isUuid(conversationId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("call_sessions")
    .select(CALL_COLUMNS)
    .eq("conversation_id", conversationId)
    .in("status", ["ringing", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CallSession | null) ?? null;
}

/** Everything the thread needs to render the call affordance in one pass. */
export async function getCallContext(
  conversationId: string,
): Promise<CallContext> {
  if (!isUuid(conversationId)) {
    return { isDirect: false, partner: null, activeCall: null };
  }
  const supabase = await createClient();
  const [convo, members] = await Promise.all([
    supabase.from("conversations").select("type").eq("id", conversationId).maybeSingle(),
    supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId),
  ]);

  const isDirect = convo.data?.type === "direct";
  const memberIds = ((members.data ?? []) as { user_id: string }[]).map(
    (m) => m.user_id,
  );

  let partner: CallPartner | null = null;
  if (isDirect) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const otherId = memberIds.find((id) => id !== user?.id);
    if (otherId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle();
      partner = (profile as CallPartner | null) ?? null;
    }
  }

  const activeCall = isDirect ? await getActiveCall(conversationId) : null;
  return { isDirect, partner, activeCall };
}

// ---------------------------------------------------------------------------
// Mutations — thin RPC wrappers; the live RPCs own all authorization
// ---------------------------------------------------------------------------

async function invokeVoidRpc(
  fn: string,
  params: Record<string, unknown>,
): Promise<CallActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, params);
  if (error) return { ok: false, error: describeCallError(error.code, error.message) };
  return { ok: true, callId: null };
}

async function invokeCallIdRpc(
  fn: string,
  params: Record<string, unknown>,
): Promise<CallActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, params);
  if (error) return { ok: false, error: describeCallError(error.code, error.message) };
  const callId = typeof data === "string" ? data : null;
  return { ok: true, callId };
}

/** Ring the other member of a direct conversation. Returns the call id. */
export async function startCall(conversationId: string): Promise<CallActionResult> {
  if (!isUuid(conversationId)) {
    return { ok: false, error: "Invalid conversation." };
  }
  return invokeCallIdRpc("start_dm_call", { p_conv_id: conversationId });
}

/** Callee accepts a ringing call. Returns the conversation id. */
export async function answerCall(callId: string): Promise<CallActionResult> {
  if (!isUuid(callId)) return { ok: false, error: "Invalid call." };
  return invokeCallIdRpc("answer_dm_call", { p_call_id: callId });
}

export async function declineCall(callId: string): Promise<CallActionResult> {
  if (!isUuid(callId)) return { ok: false, error: "Invalid call." };
  return invokeVoidRpc("decline_dm_call", { p_call_id: callId });
}

export async function cancelCall(callId: string): Promise<CallActionResult> {
  if (!isUuid(callId)) return { ok: false, error: "Invalid call." };
  return invokeVoidRpc("cancel_dm_call", { p_call_id: callId });
}

export async function endCall(callId: string): Promise<CallActionResult> {
  if (!isUuid(callId)) return { ok: false, error: "Invalid call." };
  return invokeVoidRpc("end_dm_call", { p_call_id: callId });
}

export async function timeoutCall(callId: string): Promise<CallActionResult> {
  if (!isUuid(callId)) return { ok: false, error: "Invalid call." };
  return invokeVoidRpc("timeout_dm_call", { p_call_id: callId });
}
