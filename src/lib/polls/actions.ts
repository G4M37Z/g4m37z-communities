"use server";

// ============================================================================
// src/lib/polls/actions.ts — server actions for polls.
// ============================================================================

import { revalidatePath } from "next/cache";
import {
  createPollForPost,
  voteOnPoll,
  removeVoteOnPoll,
  type CreatePollInput,
} from "./service";

export async function createPollAction(postId: string, input: CreatePollInput) {
  const res = await createPollForPost(postId, input);
  if (res.ok) revalidatePath(`/post/${postId}`);
  return res;
}

export async function voteOnPollAction(pollId: string, optionId: string) {
  const res = await voteOnPoll(pollId, optionId);
  return { ok: res.ok, error: res.error, poll: res.poll };
}

export async function removeVoteOnPollAction(pollId: string) {
  const res = await removeVoteOnPoll(pollId);
  return { ok: res.ok, error: res.error, poll: res.poll };
}
