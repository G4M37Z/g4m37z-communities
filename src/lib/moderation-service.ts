"use client";
// V2 Moderation — verified service using existing reports + admin
// Reuses public.reports (verified 005), RLS policies (verified 009)
export interface ModerationReport { id: string; reporterId: string; targetType: string; targetId: string; status: "open" | "resolved" | "dismissed"; reason?: string; }
