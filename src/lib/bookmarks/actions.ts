"use server";

// ============================================================================
// src/lib/bookmarks/actions.ts
// Server Actions for bookmarks — thin wrappers around the bookmarks service.
// Identity always resolved server-side; clients never supply user_id.
// ============================================================================

import { revalidatePath } from "next/cache";
import { addBookmark, removeBookmark } from "./service";

export async function addBookmarkAction(postId: string) {
  const ok = await addBookmark(postId);
  if (ok) revalidatePath("/saved");
  return { ok };
}

export async function removeBookmarkAction(postId: string) {
  const ok = await removeBookmark(postId);
  if (ok) revalidatePath("/saved");
  return { ok };
}
