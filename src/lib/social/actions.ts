// ============================================================================
// src/lib/social/actions.ts
// Server Actions for the social graph — thin wrappers delegating to the
// social service (RLS-scoped edge mutations + notification reads).
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import {
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  markNotificationEventRead,
  markAllNotificationEventsRead,
} from "@/lib/social/service";

export async function followUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await followUser(userId);
  revalidatePath("/social");
}

export async function unfollowUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await unfollowUser(userId);
  revalidatePath("/social");
}

export async function blockUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await blockUser(userId);
  revalidatePath("/social");
}

export async function unblockUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await unblockUser(userId);
  revalidatePath("/social");
}

export async function muteUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await muteUser(userId);
  revalidatePath("/social");
}

export async function unmuteUserAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  if (!userId) return;
  await unmuteUser(userId);
  revalidatePath("/social");
}

export async function markNotificationEventReadAction(formData: FormData) {
  const eventId = formData.get("eventId") as string;
  if (!eventId) return;
  await markNotificationEventRead(eventId);
  revalidatePath("/social");
}

export async function markAllNotificationsReadAction() {
  await markAllNotificationEventsRead();
  revalidatePath("/social");
}