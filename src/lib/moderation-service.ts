// ============================================================================
// src/lib/moderation-service.ts
// V2 Moderation — server service over the reports table (005) and the
// notification RPC. RLS lets only admins/moderators read & update reports.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface ModerationReport {
  id: string;
  reporter_id: string;
  reporter_username: string | null;
  target_type: "post" | "comment" | "user";
  target_id: string;
  status: ReportStatus;
  reason?: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listModerationReports(
  status?: ReportStatus,
): Promise<ModerationReport[]> {
  const supabase = await createClient();
  let q = supabase
    .from("reports")
    .select(
      `id, reporter_id, reporter:profiles!reports_reporter_id_fkey ( username ), target_type, target_id, status, reason, resolved_by, resolved_at, created_at`,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Array<{
    id: string;
    reporter_id: string;
    reporter: { username: string } | { username: string }[] | null;
    target_type: ModerationReport["target_type"];
    target_id: string;
    status: ReportStatus;
    reason: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
  }>).map((r) => {
    const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
    return {
      id: r.id,
      reporter_id: r.reporter_id,
      reporter_username: reporter?.username ?? null,
      target_type: r.target_type,
      target_id: r.target_id,
      status: r.status,
      reason: r.reason,
      resolved_by: r.resolved_by,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
    };
  });
}

export type ModerationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resolveReport(reportId: string): Promise<ModerationResult> {
  return setReportStatus(reportId, "resolved");
}

export async function dismissReport(reportId: string): Promise<ModerationResult> {
  return setReportStatus(reportId, "dismissed");
}

async function setReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<ModerationResult> {
  if (!uuidRe.test(reportId)) return { ok: false, error: "Invalid report." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("reports")
    .update({
      status,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (error) return { ok: false, error: "Could not update the report." };
  return { ok: true };
}