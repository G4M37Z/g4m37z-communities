// ============================================================================
// src/lib/messaging/actions.ts
// Server Actions for messaging — thin wrappers that delegate the actual work
// (validation, RLS-scoped writes) to the messaging service. Action result
// shape is preserved for the existing forms/pages.
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createDirectConversation, sendMessage as sendMessageService } from "@/lib/messaging/service";

const MAX_USERNAME = 32;
const MIN_USERNAME = 2;

export type MessageActionState =
  | { ok: true }
  | { ok: false; error: string };

const initialState: MessageActionState = { ok: true };

export async function _getInitial(): Promise<MessageActionState> {
  return initialState;
}

export async function createConversation(
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to send messages." };

  const recipientUsername = (formData.get("recipient") as string)?.trim();
  if (!recipientUsername || recipientUsername.length < MIN_USERNAME || recipientUsername.length > MAX_USERNAME) {
    return { ok: false, error: "Enter a valid username." };
  }

  // Look up recipient by username.
  const { data: recipient, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", recipientUsername)
    .maybeSingle();
  if (lookupErr || !recipient) {
    return { ok: false, error: "User not found." };
  }
  if (recipient.id === user.id) {
    return { ok: false, error: "You cannot message yourself." };
  }

  const initialMessage = (formData.get("message") as string) ?? "";
  const result = await createDirectConversation(recipient.id, initialMessage);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/messages");
  redirect(`/messages/${result.conversation_id}`);
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<MessageActionState> {
  const result = await sendMessageService(conversationId, body);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}