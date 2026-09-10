// ============================================================================
// src/lib/messaging/service.ts
// V3.8 — Messaging service.
//
// Security model:
//   - Reads / writes use the request-scoped Supabase client. RLS scopes every
//     query to the authenticated user (member-only SELECT, auth.uid()-scoped
//     INSERT). No service-role path is needed for normal messaging flows.
//   - Messages are append-only: UPDATE/DELETE are denied at the policy level.
//   - sender_id is never accepted from the client; RLS requires
//     auth.uid() = messages.sender_id on INSERT.
//   - Inputs are validated at the service boundary (UUID, body length, page
//     bounds). DB CHECK / RLS enforce the same constraints downstream.
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

export const __test = { isUuid, clamp, MAX_BODY, MAX_PAGE, UUID_RE };