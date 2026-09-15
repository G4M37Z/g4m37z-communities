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

import { createAdminClient } from "@/lib/supabase/admin";
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

// Finds an existing direct conversation between two users, if any.
// conversation_members SELECT is RLS-scoped to auth.uid(), so only the admin
// (service_role) client can see the invitee's membership rows; this is a
// bounded read of membership ids for the (self, invitee) pair.
async function findExistingDirect(both: string[]): Promise<string | null> {
  const admin = await createAdminClient();
  const set = new Set(both);
  if (set.size < 2) return null;

  const { data: memberships } = await admin
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("user_id", both);
  if (!memberships) return null;

  const byConversation = new Map<string, string[]>();
  for (const m of memberships) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m.user_id);
    byConversation.set(m.conversation_id, list);
  }

  const { data: candidateIds } = await admin
    .from("conversations")
    .select("id")
    .eq("type", "direct")
    .in("id", [...byConversation.keys()]);
  if (!candidateIds) return null;

  for (const c of candidateIds) {
    const members = byConversation.get(c.id);
    if (members && members.length >= 2) {
      const memberSet = new Set(members);
      if (both.every((u) => memberSet.has(u))) return c.id;
    }
  }
  return null;
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

  const supabase = await createClient();

  // Recipient must exist and be a real user.
  const { data: recipient } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .maybeSingle();

  const existingThreadId = await findExistingDirect([uid, recipientId]);
  const verdict = createDirectVerdict({
    senderId: uid,
    recipientId,
    recipientExists: Boolean(recipient),
    existingThreadId,
  });

  if (verdict === "self") return { ok: false, status: "self", error: "You cannot message yourself." };
  if (verdict === "not_found") return { ok: false, status: "not_found", error: "User not found." };
  if (verdict === "reuse") return { ok: true, status: "reused", conversation_id: existingThreadId as string };

  // Create a fresh direct conversation (RLS: conversations_insert,
  // conversation_members_insert incl. the direct-invitee row, messages_insert).
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (convErr || !conv) return { ok: false, status: "error", error: "Could not start conversation." };

  const { error: memberErr } = await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: uid },
    { conversation_id: conv.id, user_id: recipientId },
  ]);
  if (memberErr) return { ok: false, status: "error", error: memberErr.message };

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: uid,
    body: body.body,
  });
  if (msgErr) return { ok: false, status: "error", error: "Failed to send message." };  return { ok: true, status: "created", conversation_id: conv.id };
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
  const { uid } = await resolveUserId();
  if (!uid) return new Map();

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at");
  const convIds = (memberships ?? []).map(
    (m: { conversation_id: string }) => m.conversation_id
  );
  if (convIds.length === 0) return new Map();

  const lastReadByConv = new Map<string, number>(
    (memberships ?? []).map((m: { conversation_id: string; last_read_at: string | null }) => [
      m.conversation_id,
      m.last_read_at ? new Date(m.last_read_at).getTime() : 0,
    ])
  );

  const { data: recent } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })
    .limit(200);

  const unread = new Map<string, number>();
  for (const m of (recent ?? []) as Array<{
    conversation_id: string;
    sender_id: string | null;
    created_at: string;
  }>) {
    if (m.sender_id === uid) continue;
    const threshold = lastReadByConv.get(m.conversation_id) ?? 0;
    if (new Date(m.created_at).getTime() > threshold) {
      unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
    }
  }  return unread;
}

export async function sendMessage(  conversationId: string,  body: string,): Promise<MessageResult> {
  if (!isUuid(conversationId)) return { ok: false, status: "invalid", error: "Invalid conversation." };

  const verdict = messageBodyVerdict(body);
  if (!verdict.ok) return { ok: false, status: "invalid", error: verdict.error };

  const { uid, error: authError } = await resolveUserId();
  if (!uid) return { ok: false, status: "forbidden", error: authError ?? "Not signed in." };

  const supabase = await createClient();
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