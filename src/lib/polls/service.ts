// ============================================================================
// src/lib/polls/service.ts
// V5 — Polls attached to posts (migration 032 schema).
//
// Security model:
//   - Identity always resolved server-side from the cookie-bound session;
//     clients never supply user_id / created_by.
//   - Reads use the request-scoped client; polls RLS inherits post
//     visibility. Vote mutations use the same client — RLS enforces
//     user_id = auth.uid() and same-poll option membership (032).
//   - One vote per user per poll is enforced by PK (poll_id, user_id);
//     changing a vote is an UPDATE of the same row (no duplicates).
// ============================================================================

import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_OPTIONS = 8;
const MIN_OPTIONS = 2;
const LABEL_MAX = 120;
const QUESTION_MAX = 300;

export interface PollOption {
  id: string;
  label: string;
  position: number;
  votes: number;
}

export interface PollView {
  id: string;
  question: string;
  multiple: boolean;
  expires_at: string | null;
  closed: boolean;
  totalVotes: number;
  options: PollOption[];
  myOptionId: string | null;
  /** Voter identities are never exposed — only aggregate counts. */
}

export interface CreatePollInput {
  question: string;
  options: string[];
  /** Hours until the poll closes; null/undefined = no expiry. */
  expiresInHours?: number | null;
}

export type PollResult =
  | { ok: true; pollId: string }
  | { ok: false; error: string };

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function validatePollInput(
  input: CreatePollInput
): { ok: true; question: string; options: string[]; expiresAt: string | null } | { ok: false; error: string } {
  const question = String(input.question ?? "").trim();
  if (question.length < 1 || question.length > QUESTION_MAX) {
    return { ok: false, error: `Question must be 1–${QUESTION_MAX} characters.` };
  }
  const labels = (input.options ?? [])
    .map((o) => String(o ?? "").trim())
    .filter((o) => o.length > 0)
    .map((o) => o.slice(0, LABEL_MAX));
  const unique = Array.from(new Set(labels.map((l) => l.toLowerCase())));
  if (unique.length < MIN_OPTIONS) {
    return { ok: false, error: "A poll needs at least 2 distinct options." };
  }
  if (labels.length > MAX_OPTIONS) {
    return { ok: false, error: `A poll allows at most ${MAX_OPTIONS} options.` };
  }
  let expiresAt: string | null = null;
  if (input.expiresInHours !== undefined && input.expiresInHours !== null) {
    const h = Number(input.expiresInHours);
    if (!Number.isFinite(h) || h < 1 || h > 24 * 30) {
      return { ok: false, error: "Expiry must be between 1 and 720 hours." };
    }
    expiresAt = new Date(Date.now() + h * 3600_000).toISOString();
  }
  return { ok: true, question, options: labels, expiresAt };
}

/** Poll for a post, with aggregate counts and the caller's own vote. */
export async function getPollForPost(postId: string): Promise<PollView | null> {
  if (!isUuid(postId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: poll } = await supabase
    .from("polls")
    .select("id, question, multiple, expires_at")
    .eq("post_id", postId)
    .maybeSingle();
  if (!poll) return null;

  const [{ data: options }, { data: votes }, { data: mine }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, label, position")
      .eq("poll_id", poll.id)
      .order("position", { ascending: true }),
    supabase.from("poll_votes").select("option_id").eq("poll_id", poll.id),
    user
      ? supabase
          .from("poll_votes")
          .select("option_id")
          .eq("poll_id", poll.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const voteCounts = new Map<string, number>();
  for (const v of (votes ?? []) as { option_id: string }[]) {
    voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
  }

  const opts: PollOption[] = ((options ?? []) as { id: string; label: string; position: number }[]).map(
    (o) => ({ id: o.id, label: o.label, position: o.position, votes: voteCounts.get(o.id) ?? 0 })
  );

  const closed =
    poll.expires_at !== null && new Date(poll.expires_at).getTime() <= Date.now();

  return {
    id: poll.id,
    question: poll.question,
    multiple: poll.multiple,
    expires_at: poll.expires_at,
    closed,
    totalVotes: opts.reduce((s, o) => s + o.votes, 0),
    options: opts,
    myOptionId: (mine as { option_id: string } | null)?.option_id ?? null,
  };
}

/** Create a poll attached to an existing post. Caller must be the post author. */
export async function createPollForPost(
  postId: string,
  input: CreatePollInput
): Promise<PollResult> {
  if (!isUuid(postId)) return { ok: false, error: "Invalid post id." };
  const v = validatePollInput(input);
  if (!v.ok) return { ok: false, error: v.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  // RLS also enforces this; explicit check gives a clearer error.
  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Post not found." };
  if ((post as { author_id: string }).author_id !== user.id) {
    return { ok: false, error: "Only the post author can attach a poll." };
  }

  const { data: existing } = await supabase
    .from("polls")
    .select("id")
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) return { ok: false, error: "This post already has a poll." };

  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .insert({
      post_id: postId,
      question: v.question,
      multiple: false,
      expires_at: v.expiresAt,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (pollErr || !poll) {
    console.error("createPollForPost insert failed:", pollErr);
    return { ok: false, error: "Couldn't create the poll. Try again." };
  }
  const pollId = (poll as { id: string }).id;

  const { error: optErr } = await supabase.from("poll_options").insert(
    v.options.map((label, i) => ({ poll_id: pollId, label, position: i }))
  );
  if (optErr) {
    // Roll back the poll so the author can retry.
    await supabase.from("polls").delete().eq("id", pollId);
    console.error("createPollForPost options insert failed:", optErr);
    return { ok: false, error: "Couldn't create the poll options. Try again." };
  }
  return { ok: true, pollId };
}

/** Cast or change the caller's vote. Returns a fresh PollView on success. */
export async function voteOnPoll(
  pollId: string,
  optionId: string
): Promise<{ ok: boolean; error?: string; poll?: PollView }> {
  if (!isUuid(pollId) || !isUuid(optionId)) {
    return { ok: false, error: "Invalid vote." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to vote." };

  const { data: poll } = await supabase
    .from("polls")
    .select("id, expires_at")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) return { ok: false, error: "Poll not found." };
  if (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This poll has closed." };
  }

  // Upsert semantics: PK (poll_id, user_id) makes this one row per user.
  const { error } = await supabase.from("poll_votes").upsert(
    { poll_id: pollId, user_id: user.id, option_id: optionId, voted_at: new Date().toISOString() },
    { onConflict: "poll_id,user_id" }
  );
  if (error) {
    console.error("voteOnPoll failed:", error);
    return { ok: false, error: "Couldn't record your vote. Try again." };
  }
  const pollView = await getPollForPost(
    (await supabase.from("polls").select("post_id").eq("id", pollId).maybeSingle()).data?.post_id ?? ""
  );
  return { ok: true, poll: pollView ?? undefined };
}

/** Remove the caller's vote (un-vote). */
export async function removeVoteOnPoll(
  pollId: string
): Promise<{ ok: boolean; error?: string; poll?: PollView }> {
  if (!isUuid(pollId)) return { ok: false, error: "Invalid poll." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: poll } = await supabase
    .from("polls")
    .select("id, expires_at, post_id")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) return { ok: false, error: "Poll not found." };
  if (poll.expires_at && new Date(poll.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This poll has closed." };
  }

  const { error } = await supabase
    .from("poll_votes")
    .delete()
    .eq("poll_id", pollId)
    .eq("user_id", user.id);
  if (error) {
    console.error("removeVoteOnPoll failed:", error);
    return { ok: false, error: "Couldn't remove your vote. Try again." };
  }
  const pollView = await getPollForPost(poll.post_id);
  return { ok: true, poll: pollView ?? undefined };
}
