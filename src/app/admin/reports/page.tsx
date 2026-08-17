// src/app/admin/reports/page.tsx
// Reports dashboard — list open reports + history. Admins/moderators can
// resolve/dismiss and inspect the reported content.

import { Flag, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveReport } from "@/lib/reports/actions";
import { timeAgo } from "@/lib/utils";
import type { Report } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports — Admin — G4M37Z Communities",
  description: "Manage reported content.",
};

type EnrichedReport = Report & {
  reporter: { username: string } | null;
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status: "open" | "resolved" | "dismissed" | "all" =
    statusParam === "resolved" || statusParam === "dismissed" || statusParam === "all"
      ? statusParam
      : "open";

  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, status, resolved_by, created_at, resolved_at, reporter:profiles!reports_reporter_id_fkey ( username )")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: reports } = await query;

  const enriched: EnrichedReport[] = (reports ?? []).map((r: { id: string; reporter_id: string; target_type: string; target_id: string; reason: string | null; status: string; resolved_by: string | null; created_at: string; resolved_at: string | null; reporter: { username: string } | { username: string }[] | null }) => {
    const reporterRel = r.reporter;
    const reporter = Array.isArray(reporterRel) ? reporterRel[0] ?? null : reporterRel ?? null;
    return {
      ...r,
      reporter,
    } as EnrichedReport;
  });

  return (
    <>
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
            Reports
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Review reported content and take action.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface p-1">
          {[
            { label: "Open", value: "open" },
            { label: "Resolved", value: "resolved" },
            { label: "Dismissed", value: "dismissed" },
            { label: "All", value: "all" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={`/admin/reports?status=${opt.value}`}
              className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                status === opt.value
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-fg"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </header>

      {enriched.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Flag size={36} className="mx-auto mb-4 text-text-muted" />
          <h2 className="mb-1 text-base font-bold text-fg">No reports here</h2>
          <p className="mx-auto max-w-md text-sm text-text-muted">
            {status === "open"
              ? "Nothing to review right now."
              : `No reports with status "${status}".`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {enriched.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </>
  );
}

function ReportCard({ report }: { report: EnrichedReport }) {
  const target = getTargetHref(report.target_type, report.target_id);

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Flag size={14} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border bg-bg px-2 py-0.5 font-medium uppercase tracking-wider text-text-muted">
              {report.target_type}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                report.status === "open"
                  ? "bg-sale/10 text-sale"
                  : report.status === "resolved"
                    ? "bg-success/10 text-success"
                    : "bg-bg text-text-muted"
              }`}
            >
              {report.status}
            </span>
            <span className="text-text-muted">
              {timeAgo(report.created_at)}
            </span>
          </div>

          {report.reason && (
            <p className="mb-2 text-sm text-fg">{report.reason}</p>
          )}

          <p className="text-xs text-text-muted">
            Reported by{" "}
            <span className="font-medium text-fg">
              {report.reporter ? `@${report.reporter.username}` : "unknown"}
            </span>
          </p>

          {target.href && (
            <Link
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <ExternalLink size={11} />
              View {report.target_type}
            </Link>
          )}
        </div>

        {report.status === "open" && (
          <div className="flex shrink-0 flex-col gap-2">
            <form action={async (fd) => {
              "use server";
              await resolveReport(String(fd.get("reportId")), "resolved");
            }}>
              <input type="hidden" name="reportId" value={report.id} />
              <button
                type="submit"
                className="rounded-md bg-success/15 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20"
              >
                Resolve
              </button>
            </form>
            <form action={async (fd) => {
              "use server";
              await resolveReport(String(fd.get("reportId")), "dismissed");
            }}>
              <input type="hidden" name="reportId" value={report.id} />
              <button
                type="submit"
                className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-fg"
              >
                Dismiss
              </button>
            </form>
          </div>
        )}
      </div>
    </li>
  );
}

function getTargetHref(type: string, id: string): { href: string | null } {
  if (type === "post") return { href: `/post/${id}` };
  if (type === "comment") return { href: `/post/${id}#comments` };
  if (type === "user") return { href: null };
  return { href: null };
}
