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
import { normalizeUsername } from "@/lib/profiles/username";
import {
  createDirectConversation,
  sendMessage as sendMessageService,
  markConversationRead,
    getUnreadCounts,
  blockedUserIds,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_MIME,
  type RecipientSuggestion,
} from "@/lib/messaging/service";

const MAX_USERNAME = 32;
const MIN_USERNAME = 2;

export type MessageActionState =
  | { ok: true; message_id?: string }
  | { ok: false; error: string };

const initialState: MessageActionState = { ok: true };

export async function _getInitial(): Promise<MessageActionState> {
  return initialState;
}

export async function createConversation(
  _prevState: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const resolved = await resolveConversation(formData);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  revalidatePath("/messages");
  redirect(`/messages/${resolved.conversation_id}`);
}

// Does the DB work outside the action's control flow so a thrown redirect()
// (which Next implements as an exception) is never swallowed by the guard.
async function resolveConversation(
  formData: FormData,
): Promise<{ ok: true; conversation_id: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to send messages." };

    // Canonicalize: @Derick, Derick and derick all resolve to the same row.
    const recipientUsername = normalizeUsername(String(formData.get("recipient") ?? ""));
    if (recipientUsername.length < MIN_USERNAME || recipientUsername.length > MAX_USERNAME) {
      return { ok: false, error: "Enter a valid username." };
    }

    const { data: recipient } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", recipientUsername)
      .maybeSingle();
    if (!recipient) {
      return { ok: false, error: `We couldn't find @${recipientUsername}. Check the username and try again.` };
    }
    if (recipient.id === user.id) {
      return { ok: false, error: "You cannot message yourself." };
    }

    const initialMessage = String(formData.get("message") ?? "");
    const result = await createDirectConversation(recipient.id, initialMessage);
    if (!result.ok) return { ok: false, error: result.error };

    return { ok: true, conversation_id: result.conversation_id };
  } catch (err) {
    console.error("createConversation failed:", err);
    return { ok: false, error: "Something went wrong starting the conversation. Please try again." };
  }
}

/** Typeahead for the recipient picker: matches username + display name,
 * case-insensitively, excluding the caller. Never throws. */
export async function searchRecipients(query: string): Promise<RecipientSuggestion[]> {
  const q = normalizeUsername(query);
  if (q.length === 0) return [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
      .neq("id", user.id)
      .order("username", { ascending: true })
      .limit(8);
    const matches = (data ?? []) as RecipientSuggestion[];
    // Exclude people the caller blocked or who blocked the caller.
    const blocked = await blockedUserIds(user.id);
    return matches.filter((p) => !blocked.has(p.id));
  } catch {
    return [];
  }
}

/**
 * Upload an image/GIF/sticker for a direct-thread message into the
 * message-attachments bucket (047). Same trust model as post images: the
 * browser MIME is client-controlled, so bytes are sniffed; the object is
 * stored under auth.uid()/ and the URL returned for the send action.
 */
export async function uploadMessageAttachment(
  file: File,
): Promise<{ ok: true; url: string; type: "image" | "gif" | "sticker" } | { ok: false; error: string }> {
  try {
    if (file.size === 0) return { ok: false, error: "File is empty." };
    if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Image must be 5 MB or smaller." };
    if (!ATTACHMENT_MIME.includes(file.type as (typeof ATTACHMENT_MIME)[number])) {
      return { ok: false, error: "Image must be JPEG, PNG, WebP, or GIF." };
    }

    // Content sniff — reject files whose bytes are not a real image.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const b = (i: number) => head[i];
    const isJpeg = head.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff;
    const isPng = head.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47;
    const isWebp = head.length >= 12 && b(0) === 0x52 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42;
    const isGif = head.length >= 6 && b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46;
    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return { ok: false, error: "That file doesn't look like a valid image." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to attach images." };

    const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage
      .from("message-attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (error) {
      console.error("uploadMessageAttachment failed:", error);
      return { ok: false, error: "Couldn't upload the image. Try again." };
    }

    const { data } = supabase.storage.from("message-attachments").getPublicUrl(path);
    // Animated GIFs are surfaced as "gif" so the UI can badge them; every
    // other still image is "image". (Stickers reuse the same renderer.)
    return { ok: true, url: data.publicUrl, type: isGif ? "gif" : "image" };
  } catch (err) {
    console.error("uploadMessageAttachment unexpected error:", err);
    return { ok: false, error: "Couldn't upload the image. Try again." };
  }
}

export async function sendMessage(
  conversationId: string,
  body: string,
  attachment?: { url: string; type: "image" | "gif" | "sticker" },
): Promise<MessageActionState> {
  try {
    const result = await sendMessageService(conversationId, body, attachment);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/messages/${conversationId}`);
    return { ok: true, message_id: result.message_id };
  } catch (err) {
    console.error("sendMessage failed:", err);
    return { ok: false, error: "Your message didn't send. Please try again." };
  }
}



/** Marks a thread read for the signed-in member. Silent no-op when

  * unauthenticated or the update is denied (RLS fails closed). */

export async function markReadAction(
  conversationId: string
): Promise<{ ok: boolean }> {
  try {
    const ok = await markConversationRead(conversationId);
    if (ok) revalidatePath("/messages");
    return { ok };
  } catch {
    return { ok: false };
  }
}



/** Server-side unread counts for the conversations list. */

export async function getUnreadCountsAction(): Promise<Map<string, number>> {

  return getUnreadCounts();

}