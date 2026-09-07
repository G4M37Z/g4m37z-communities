"use client";
// Notification event architecture — V2 cross-system
// Uses verified DB (notifications table from 005)

export interface NotificationEvent {
  type: "reaction" | "comment" | "reply" | "mention" | "membership" | "moderation" | "voice" | "event";
  userId: string;
  contentId: string;
  communityId?: string;
  message: string;
}

export const EVENT_TYPES = ["reaction", "comment", "reply", "mention", "membership", "moderation", "voice", "event"] as const;
