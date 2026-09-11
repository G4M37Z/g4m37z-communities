// ============================================================================
// src/lib/reactions/actions.ts
// Server Actions for React / Emoji reactions (V1 expression layer, 009).
//
// RLS enforces auth.uid() = user_id on writes; the unique (post_id, user_id)
// constraint prevents duplicate reactions. A reaction with the same type that
// already exists is removed (toggle); a different existing reaction is
// replaced (type switch).
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const REACTION_TYPES = ["like", "love", "laugh", "wow", "sad", "angry"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReactionActionResult =
  | { ok: true; reaction: ReactionType | null }
  | { ok: false; error: string };

export async function setReaction(
  postId: string,
  reactionType: string | null,
): Promise<ReactionActionResult> {
  if (!UUID_RE.test(postId)) return { ok: false, error: "Invalid post." };
  if (reactionType !== null && !(REACTION_TYPES as readonly string[]).includes(reactionType)) {
    return { ok: false, error: "Invalid reaction type." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to react." };

  // Existing reaction (if any) by this user on this post.
  const { data: existing } = await supabase
    .from("reactions")
    .select("reaction_type")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Toggle off.
      const { error } = await supabase
        .from("reactions")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: "Could not remove reaction." };
      revalidatePath(`/post/${postId}`);
      return { ok: true, reaction: null };
    }
    // Switch type.
    const { error } = await supabase
      .from("reactions")
      .update({ reaction_type: reactionType })
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Could not update reaction." };
    revalidatePath(`/post/${postId}`);
    return { ok: true, reaction: reactionType as ReactionType };
  }

  // New reaction.
  const { error } = await supabase.from("reactions").insert({
    post_id: postId,
    user_id: user.id,
    reaction_type: reactionType,
  });
  if (error) return { ok: false, error: "Could not save reaction." };
  revalidatePath(`/post/${postId}`);
  return { ok: true, reaction: reactionType as ReactionType };
}

export const reactionTypes = REACTION_TYPES;