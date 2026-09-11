"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

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
  if (!recipientUsername || recipientUsername.length < 2 || recipientUsername.length > 32) {
    return { ok: false, error: "Enter a valid username." };
  }

  // Look up recipient
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

  const initialMessage = (formData.get("message") as string)?.trim();
  if (!initialMessage || initialMessage.length > MAX_BODY) {
    return { ok: false, error: "Message must be 1–4000 characters." };
  }

  // Create conversation
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (convErr || !conv) {
    return { ok: false, error: "Could not start conversation." };
  }

  // Add members (sender via user_id = auth.uid(); invitee via direct type)
  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: recipient.id },
  ]);

  // Send initial message
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: user.id,
    body: initialMessage,
  });
  if (msgErr) {
    return { ok: false, error: "Failed to send message." };
  }

  revalidatePath("/messages");
  redirect(`/messages/${conv.id}`);
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<MessageActionState> {
  if (!UUID_RE.test(conversationId)) return { ok: false, error: "Invalid conversation." };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message cannot be empty." };
  if (trimmed.length > MAX_BODY) return { ok: false, error: `Message must be ${MAX_BODY} characters or fewer.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to send messages." };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) return { ok: false, error: "Failed to send message." };

  revalidatePath(`/messages/${conversationId}`);
  return { ok: true };
}
