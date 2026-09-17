// ============================================================================
// src/lib/messaging/service.ts
// V3.8 — Messaging service (full implementation).
//
// Security model:
//   - Reads / writes use the request-scoped Supabase client. RLS scopes every
//     query to the authenticated user (member-only SELECT, auth.uid()-scoped
//     INSERT). No service-role path is used for messaging flows.
//   - Messages are append-only: UPDATE/DELETE are denied at the policy level
//     (020), which also means read receipts cannot be written under the
//     current schema.
//   - sender_id is never accepted from the client; it is server-resolved to
//     auth.uid(), and RLS requires auth.uid() = messages.sender_id on INSERT.
//   - Inputs are validated at the service boundary (UUID, body length, page
//     bounds). DB CHECK / RLS enforce the same constraints downstream.
//   - Pure validation / verdict helpers are exported through `__test` for
//     deterministic unit coverage (see tests/messaging-service.test.ts).
// ============================================================================

import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;
const MAX_PAGE = 50;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export interface Conversation {
  id: string;
  type: string | null;
  name: string | null;
  context_type: string | null;
  context_id: string | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  body: string;
  read: boolean | null;
  delivered: boolean | null;
  created_at: string | null;
}

export type ConversationResult =
  | { ok: true; status: "created" | "reused"; conversation_id: string }
  | { ok: false; status: "error" | "invalid" | "forbidden" | "self" | "not_found"; error: string };

export type MessageResult =
  | { ok: true; status: "sent"; message_id?: string }
  | { ok: false; status: "error" | "invalid" | "forbidden" | "not_found"; error: string };

// ---------------------------------------------------------------------------
// Pure validation & verdicts (unit-testable — exported via __test)
// ---------------------------------------------------------------------------

// Normalises a message body: trims, validates range. Returns the canonical
// body on ok.
export type BodyVerdict = { ok: true; body: string } | { ok: false; error: string };

export function messageBodyVerdict(body: string): BodyVerdict {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Message cannot be empty." };
  if (trimmed.length > MAX_BODY) return { ok: false, error: `Message must be ${MAX_BODY} characters or fewer.` };
  return { ok: true, body: trimmed };
}

export interface CreateDirectArgs {
  senderId: string;
  recipientId: string;
  recipientExists: boolean;
  existingThreadId: string | null;
}

export type CreateDirectVerdict = "self" | "not_found" | "reuse" | "ok";

export function createDirectVerdict(args: CreateDirectArgs): CreateDirectVerdict {
  if (args.senderId === args.recipientId) return "self";
  if (!args.recipientExists) return "not_found";
  if (args.existingThreadId) return "reuse";
  return "ok";
}

// ---------------------------------------------------------------------------
// Conversation list (RLS: member-scoped SELECT)
// ---------------------------------------------------------------------------

export async function listConversations(limit = 20): Promise<Conversation[]> {
  const supabase = await createClient();
  const cap = clamp(limit, 1, MAX_PAGE);
  const { data } = await supabase
    .from("conversations")
    .select("id, type, name, context_type, context_id, created_at")
    .order("created_at", { ascending: false })
    .limit(cap);
  return (data ?? []) as Conversation[];
}

export interface RecipientSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Graph-first suggestions for the new-message picker: people the caller
 * follows plus people they already message. Caller-scoped, no service role. */
export async function listMessageSuggestions(limit = 8): Promise<RecipientSuggestion[]> {
  const { uid } = await resolveUserId();
  if (!uid) return [];
  const cap = clamp(limit, 1, MAX_PAGE);
  const supabase = await createClient();
  const byId = new Map<string, RecipientSuggestion>();

  // People the caller follows (follows SELECT is RLS-scoped to follower_id).
  const { data: follows } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", uid)
    .order("followed_at", { ascending: false })
    .limit(cap);
  const ids = (follows ?? []).map((f: { followed_id: string }) => f.followed_id);
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    for (const p of (profiles ?? []) as RecipientSuggestion[]) byId.set(p.id, p);
  }

  // People the caller already has a direct conversation with (RPC 037).
  const { data: partners } = await supabase.rpc("list_message_partners");
  for (const p of (partners ?? []) as RecipientSuggestion[]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  return [...byId.values()].slice(0, cap);
}

// ---------------------------------------------------------------------------
// Message list — ascending, page-based (offset bounded by MAX_PAGE per page)
// ---------------------------------------------------------------------------

export async function listMessages(
  conversationId: string,
  page = 1,
): Promise<Message[]> {
  if (!isUuid(conversationId)) return [];
  const pageSize = clamp(page > 0 ? 20 : 1, 1, MAX_PAGE);
  const from = (Math.max(page, 1) - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, read, delivered, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .range(from, to);
  return (data ?? []) as Message[];
}

// ---------------------------------------------------------------------------
// Mutations — request-scoped client (RLS re-enforces auth.uid() server-side)
// ---------------------------------------------------------------------------

async function resolveUserId(): Promise<{ uid: string | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { uid: null, error: "Not signed in." };
  return { uid: user.id };
}

/** True when the signed-in user is a member of the conversation. */
export async function isConversationMember(conversationId: string): Promise<boolean> {
  if (!isUuid(conversationId)) return false;
  const { uid } = await resolveUserId();
  if (!uid) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", uid)
    .maybeSingle();
  return Boolean(data);
}

export async function createDirectConversation(
  recipientId: string,
  initialBody: string,
): Promise<ConversationResult> {
  if (!isUuid(recipientId)) return { ok: false, status: "invalid", error: "Invalid recipient." };

  const body = messageBodyVerdict(initialBody);
  if (!body.ok) return { ok: false, status: "invalid", error: body.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  if (uid === recipientId) return { ok: false, status: "self", error: "You cannot message yourself." };

  // Create-or-reuse is delegated to public.create_direct_conversation
  // (migration 038), a SECURITY DEFINER RPC that atomically creates the
  // conversation, BOTH member rows and the first message — or appends the
  // message to the existing direct thread. The old client-side writes were
  // impossible under RLS: a fresh conversation's RETURNING id is filtered by
  // the member-only conversations SELECT policy (no membership exists yet),
  // and a single-statement insert of both member rows violates the invitee
  // WITH CHECK, which requires the sender's row to already exist.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_direct_conversation", {
    p_other: recipientId,
    p_body: body.body,
  });

  if (error) {
    if (error.code === "22023") return { ok: false, status: "invalid", error: "Invalid request." };
    if (error.code === "P0002") return { ok: false, status: "not_found", error: "User not found." };
    if (error.code === "28000") return { ok: false, status: "forbidden", error: "Sign in to send messages." };
    console.error("create_direct_conversation failed:", error);
    return { ok: false, status: "error", error: "Could not start conversation." };
  }

  const row = (data as Array<{ conversation_id: string; reused: boolean }> | null)?.[0];
  if (!row) return { ok: false, status: "error", error: "Could not start conversation." };

  return {
    ok: true,
    status: row.reused ? "reused" : "created",
    conversation_id: row.conversation_id,
  };
}

// ---------------------------------------------------------------------------
// Read state (033: conversation_members_update allows last_read_at only)
// ---------------------------------------------------------------------------

/** Marks a conversation read for the current user. RLS scopes the row.
 * Fails closed: returns false when unauthenticated or on any error. */
export async function markConversationRead(conversationId: string): Promise<boolean> {
  if (!isUuid(conversationId)) return false;
  const { uid } = await resolveUserId();
  if (!uid) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", uid);  return !error;
}

/** Unread counts per conversation for the current user: messages newer than
 * the user's last_read_at that they did not send. Bounded scan of the most
 * recent 200 messages across the user's conversations. */
export async function getUnreadCounts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unread_counts");

  if (error || !data) return new Map();

  const unread = new Map<string, number>();
  for (const row of (data as Array<{ conversation_id: string; unread_count: number }>) {
    unread.set(row.conversation_id, row.unread_count);
  }
  return unread;
}

export async function sendMessage(  conversationId: string,  body: string,): Promise<MessageResult> {
  if (!isUuid(conversationId)) return { ok: false, status: "invalid", error: "Invalid conversation." };

  const verdict = messageBodyVerdict(body);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const supabase = await createClient();

  // Ensure membership exists to prevent RLS 42501 failures on subsequent messages
  const { error: memberError } = await supabase.rpc("ensure_conversation_membership", {
    p_conv_id: conversationId,
  });
  if (memberError) {
    console.error("ensure_conversation_membership failed:", memberError);
    return { ok: false, status: "error", error: "Could not verify conversation membership." };
  }

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: uid, body: verdict.body })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return { ok: false, status: "forbidden", error: "You are not a member of this conversation." };
    return { ok: false, status: "error", error: error.message };
  }

  return { ok: true, status: "sent", message_id: inserted?.id };
}

export const __test = {
  isUuid,
  clamp,
  MAX_BODY,
  MAX_PAGE,
  UUID_RE,
  messageBodyVerdict,
  createDirectVerdict,
};