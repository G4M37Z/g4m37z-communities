"use server";

// src/lib/reposts/actions.ts — server actions for repost/unrepost.

import { revalidatePath } from "next/cache";
import { createRepost, removeRepost } from "./service";

export type RepostActionState =
  | { ok: true; status: "created" | "already" | "removed" | "absent" }
  | { ok: false; error: string };

export async function repostAction(
  postId: string,
  comment: string | null = null
): Promise<RepostActionState> {
  const res = await createRepost(postId, comment);
  if (res.ok) {
    revalidatePath(`/post/${postId}`);
    revalidatePath("/home");
    return { ok: true, status: res.status };
  }
  return { ok: false, error: res.error };
}

export async function unrepostAction(postId: string): Promise<RepostActionState> {
  const res = await removeRepost(postId);
  if (res.ok) {
    revalidatePath(`/post/${postId}`);
    revalidatePath("/home");
    return { ok: true, status: res.status };
  }
  return { ok: false, error: res.error };
}
