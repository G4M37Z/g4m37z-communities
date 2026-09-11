"use server";
// Game-related server actions. Thin wrappers around the service helpers so
// Client Components can call them. Each action resolves the authenticated
// user from the server-side Supabase session and never trusts client input.

import {
  followGame as followGameService,
  unfollowGame as unfollowGameService,
  createGameReview as svcCreateReview,
  updateGameReview as svcUpdateReview,
  deleteGameReview as svcDeleteReview,
  type CreateReviewInput,
  type UpdateReviewInput,
  type ReviewResult,
} from "@/lib/games/service";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ReviewActionResult extends ActionResult {
  status: ReviewResult["status"];
  reviewId?: string;
}

function reviewToAction(r: ReviewResult): ReviewActionResult {
  return r.ok
    ? { ok: true, status: r.status, reviewId: r.reviewId }
    : { ok: false, status: r.status, error: r.error ?? "Review action failed" };
}

export async function followGameAction(
  gameId: string,
): Promise<ActionResult> {
  const res = await followGameService(gameId);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "Follow failed" };
}

export async function unfollowGameAction(
  gameId: string,
): Promise<ActionResult> {
  const res = await unfollowGameService(gameId);
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "Unfollow failed" };
}

export async function createReviewAction(
  input: CreateReviewInput,
): Promise<ReviewActionResult> {
  return reviewToAction(await svcCreateReview(input));
}

export async function updateReviewAction(
  input: UpdateReviewInput,
): Promise<ReviewActionResult> {
  return reviewToAction(await svcUpdateReview(input));
}

export async function deleteReviewAction(
  reviewId: string,
): Promise<ReviewActionResult> {
  return reviewToAction(await svcDeleteReview(reviewId));
}
