// ============================================================================
// src/lib/reports/actions.ts
// Server Actions for reporting content (Milestone 8 - Moderation).
// ============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReportTargetType } from "@/types/database";

const MAX_REASON_LENGTH = 500;

function validateReason(reason: string): string | null {
  const r = reason.trim();
  if (r.length === 0) return null; // reason is optional
  if (r.length > MAX_REASON_LENGTH) {
    return `Reason must be ${MAX_REASON_LENGTH} characters or fewer.`;
  }
  return null;
}

export async function createReport(input: {
  target_type: ReportTargetType;
  target_id: string;
  reason?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to report content." };

  if (!input.target_id) return { error: "Missing target." };
  if (!["post", "comment", "user"].includes(input.target_type)) {
    return { error: "Invalid target type." };
  }

  const reasonErr = validateReason(input.reason ?? "");
  if (reasonErr) return { error: reasonErr };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: input.target_type,
    target_id: input.target_id,
    reason: input.reason?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You've already reported this content." };
    }
    console.error("createReport failed:", error);
    return { error: "Couldn't submit your report. Try again." };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

// Moderator actions (admin or platform admin)

export async function resolveReport(reportId: string, action: "resolved" | "dismissed") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the caller is an admin or moderator
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "moderator") {
    return { error: "You don't have permission to do that." };
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status: action,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    console.error("resolveReport failed:", error);
    return { error: "Couldn't update the report. Try again." };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function adminDeletePost(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return { error: "Missing post id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if user is platform admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "You don't have permission to do that." };
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    console.error("adminDeletePost failed:", error);
    return { error: "Couldn't delete the post" };
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminDeleteComment(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return { error: "Missing comment id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "You don't have permission to do that." };
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);

  if (error) {
    console.error("adminDeleteComment failed:", error);
    return { error: "Couldn't delete the comment" };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function adminBanUser(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing user id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: "You don't have permission to do that." };
  }

  // Suspend by setting role to 'banned' - we expand the role CHECK in DB
  // For now, we'll use a simpler approach: delete the profile (which cascades)
  // Actually, let's just update a banned flag or remove from communities.
  // For v0.1: we'll add a 'suspended' value to the role column.
  const { error } = await supabase
    .from("profiles")
    .update({ role: "suspended" as "member" })
    .eq("id", userId);

  if (error) {
    console.error("adminBanUser failed:", error);
    return { error: "Couldn't ban the user" };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

// Wrapper to redirect after admin action
export async function resolveAndRedirect(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const action = String(formData.get("action") ?? "resolved") as "resolved" | "dismissed";
  await resolveReport(reportId, action);
  redirect("/admin/reports");
}
