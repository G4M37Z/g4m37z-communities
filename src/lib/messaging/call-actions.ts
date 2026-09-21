// ============================================================================
// src/lib/messaging/call-actions.ts
// Server Actions for DM voice calls (GAP-MSG-CALL-01). Thin wrappers over the
// call service/RPCs, preserving the action-result shape used by the call UI.
// All authorization lives in the SECURITY DEFINER RPCs — these wrappers only
// translate errors and refresh the thread so the call-log row (written by the
// RPC's _log_call_event) is reconciled with server truth.
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import {
  startCall,
  answerCall,
  declineCall,
  cancelCall,
  endCall,
  timeoutCall,
  type CallActionResult,
} from "@/lib/messaging/calls";

async function guarded(
  conversationId: string,
  run: () => Promise<CallActionResult>,
): Promise<CallActionResult> {
  try {
    const result = await run();
    if (result.ok && conversationId) {
      revalidatePath(`/messages/${conversationId}`);
    }
    return result;
  } catch (err) {
    console.error("call action failed:", err);
    return { ok: false, error: "Something went wrong with the call. Please try again." };
  }
}

export async function startCallAction(
  conversationId: string,
  media: "audio" | "video" = "audio",
): Promise<CallActionResult> {
  return guarded(conversationId, () => startCall(conversationId, media));
}

export async function answerCallAction(
  callId: string,
  conversationId: string,
): Promise<CallActionResult> {
  return guarded(conversationId, () => answerCall(callId));
}

export async function declineCallAction(
  callId: string,
  conversationId: string,
): Promise<CallActionResult> {
  return guarded(conversationId, () => declineCall(callId));
}

export async function cancelCallAction(
  callId: string,
  conversationId: string,
): Promise<CallActionResult> {
  return guarded(conversationId, () => cancelCall(callId));
}

export async function endCallAction(
  callId: string,
  conversationId: string,
): Promise<CallActionResult> {
  return guarded(conversationId, () => endCall(callId));
}

export async function timeoutCallAction(
  callId: string,
  conversationId: string,
): Promise<CallActionResult> {
  return guarded(conversationId, () => timeoutCall(callId));
}
