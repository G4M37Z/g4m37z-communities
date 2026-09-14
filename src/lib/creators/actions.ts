// ============================================================================
// src/lib/creators/actions.ts
// Server Actions for the creators domain — thin wrappers delegating to the
// creators service (admin-client writes with ownership re-checks).
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import {
  createCreatorProfile,
  updateCreatorProfile,
  publishCreatorContent,
  followCreator,
  unfollowCreator,
} from "@/lib/creators/service";

export async function applyAsCreator(formData: FormData) {
  const displayName = (formData.get("displayName") as string)?.trim() || undefined;
  const bio = (formData.get("bio") as string)?.trim() || undefined;
  await createCreatorProfile({ displayName, bio });
  revalidatePath("/creators");
}

export async function updateCreatorProfileAction(formData: FormData) {
  const displayName = (formData.get("displayName") as string)?.trim() || undefined;
  const bio = (formData.get("bio") as string)?.trim() || undefined;
  const result = await updateCreatorProfile({ displayName, bio });
  if (result.ok) revalidatePath("/creators");
}

export async function publishCreatorContentAction(formData: FormData) {
  const contentType = (formData.get("contentType") as string) ?? "";
  const title = (formData.get("title") as string) ?? "";
  const gameId = (formData.get("gameId") as string)?.trim() || undefined;
  const body = (formData.get("body") as string)?.trim() || undefined;
  const mediaUrl = (formData.get("mediaUrl") as string)?.trim() || undefined;
  const published = formData.get("published") === "on";

  const result = await publishCreatorContent({ contentType, title, gameId, body, mediaUrl, published });
  if (result.ok) revalidatePath("/creators");
}

export async function followCreatorAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await followCreator(userId);
  revalidatePath("/creators");
}

export async function unfollowCreatorAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await unfollowCreator(userId);
  revalidatePath("/creators");
}