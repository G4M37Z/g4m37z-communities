// ============================================================================
// src/lib/comments/actions.ts
// Server Actions for comments and comment voting (Milestone 5).
//
// All mutations go through the cookie-bound Supabase client so RLS continues
// to enforce ownership.
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const BODY_MIN = 1;
const BODY_MAX = 10000;

function validateBody(body: string): string | null {
  const b = body.trim();
  if (b.length < BODY_MIN) return "Comment can't be empty.";
  if (b.length > BODY_MAX) return `Comment must be ${BODY_MAX} characters or fewer.`;
  return null;
}

// ---------------------------------------------------------------------------
// createComment
// Adds a top-level or reply comment to a post. The DB trigger maintains
// posts.comment_count.
// ---------------------------------------------------------------------------

export async function createComment(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;
  const body = String(formData.get("body") ?? "");

  if (!postId) return { error: "Missing post id." };
  const bodyErr = validateBody(body);
  if (bodyErr) return { error: bodyErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to comment." };

  // If parentId is provided, verify it belongs to the same post.
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return { error: "Parent comment not found." };
    if ((parent as { post_id: string }).post_id !== postId) {
      return { error: "Parent comment belongs to a different post." };
    }
  }

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    parent_id: parentId,
    body: body.trim(),
  });

  if (error) {
    console.error("createComment failed:", error);
    return { error: "Couldn't add the comment. Try again." };
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// editComment
// Authors can update their own comments (RLS enforces this).
// ---------------------------------------------------------------------------

export async function editComment(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "");

  if (!commentId || !postId) return { error: "Missing comment id." };
  const bodyErr = validateBody(body);
  if (bodyErr) return { error: bodyErr };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("comments")
    .update({
      body: body.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);

  if (error) {
    console.error("editComment failed:", error);
    return { error: "Couldn't update the comment. Try again." };
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deleteComment
// Authors can delete their own comments; community admins can delete any
// comment in their community (RLS enforces both).
// ---------------------------------------------------------------------------

export async function deleteComment(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const postId = String(formData.get("postId") ?? "");

  if (!commentId || !postId) return { error: "Missing comment id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("deleteComment failed:", error);
    return { error: "Couldn't delete the comment. Try again." };
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// setPostVote
// Idempotent vote on a post. Toggling:
//   - same value again → remove the vote
//   - different value → update
//   - new vote        → insert
// ---------------------------------------------------------------------------

export async function setPostVote(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const raw = Number(formData.get("value"));
  const value: 1 | -1 = raw === -1 ? -1 : 1;

  if (!postId) return { error: "Missing post id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to vote." };

  // Look up existing vote.
  const { data: existing } = await supabase
    .from("post_votes")
    .select("value")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("post_votes").insert({
      post_id: postId,
      user_id: user.id,
      value,
    });
    if (error) {
      console.error("setPostVote insert failed:", error);
      return { error: "Couldn't record your vote. Try again." };
    }
  } else {
    const current = (existing as { value: number }).value;
    if (current === value) {
      // Toggle off.
      const { error } = await supabase
        .from("post_votes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (error) {
        console.error("setPostVote delete failed:", error);
        return { error: "Couldn't update your vote. Try again." };
      }
    } else {
      // Switch direction.
      const { error } = await supabase
        .from("post_votes")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (error) {
        console.error("setPostVote update failed:", error);
        return { error: "Couldn't update your vote. Try again." };
      }
    }
  }

  // Revalidate any path that might show this post's score.
  revalidatePath(`/post/${postId}`);
  // The community feed and home feed both render scores.
  // We don't know the community here without an extra query, so revalidate
  // the root and home — coarse but safe.
  revalidatePath("/");
  revalidatePath("/home");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// setCommentVote
// Idempotent vote on a comment. Same toggle semantics as post votes.
// ---------------------------------------------------------------------------

export async function setCommentVote(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const postId = String(formData.get("postId") ?? "");
  const raw = Number(formData.get("value"));
  const value: 1 | -1 = raw === -1 ? -1 : 1;

  if (!commentId || !postId) return { error: "Missing comment id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to vote." };

  const { data: existing } = await supabase
    .from("comment_votes")
    .select("value")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("comment_votes").insert({
      comment_id: commentId,
      user_id: user.id,
      value,
    });
    if (error) {
      console.error("setCommentVote insert failed:", error);
      return { error: "Couldn't record your vote. Try again." };
    }
  } else {
    const current = (existing as { value: number }).value;
    if (current === value) {
      const { error } = await supabase
        .from("comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (error) {
        console.error("setCommentVote delete failed:", error);
        return { error: "Couldn't update your vote. Try again." };
      }
    } else {
      const { error } = await supabase
        .from("comment_votes")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (error) {
        console.error("setCommentVote update failed:", error);
        return { error: "Couldn't update your vote. Try again." };
      }
    }
  }

  revalidatePath(`/post/${postId}`);
  return { ok: true };
}