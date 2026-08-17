// src/app/admin/page.tsx
// Admin dashboard — overview stats + recent activity.

import { Users, Flag, MessageSquare, FileText, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard — G4M37Z Communities",
  description: "Platform overview and recent moderation activity.",
};

interface Stats {
  totalUsers: number;
  totalCommunities: number;
  totalPosts: number;
  totalComments: number;
  openReports: number;
  resolvedReports: number;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Parallel stat queries
  const [
    { count: totalUsers },
    { count: totalCommunities },
    { count: totalPosts },
    { count: totalComments },
    { count: openReports },
    { count: resolvedReports },
    { data: recentReports },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("communities").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase
      .from("reports")
      .select("id, target_type, reason, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats: Stats = {
    totalUsers: totalUsers ?? 0,
    totalCommunities: totalCommunities ?? 0,
    totalPosts: totalPosts ?? 0,
    totalComments: totalComments ?? 0,
    openReports: openReports ?? 0,
    resolvedReports: resolvedReports ?? 0,
  };

  const cards = [
    { label: "Total users", value: stats.totalUsers, icon: Users },
    { label: "Communities", value: stats.totalCommunities, icon: BarChart3 },
    { label: "Posts", value: stats.totalPosts, icon: FileText },
    { label: "Comments", value: stats.totalComments, icon: MessageSquare },
    { label: "Open reports", value: stats.openReports, icon: Flag },
    { label: "Resolved reports", value: stats.resolvedReports, icon: Flag },
  ];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Platform overview and recent moderation activity.
        </p>
      </header>

      <section
        aria-label="Platform statistics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  {card.label}
                </span>
                <Icon size={14} className="text-text-muted" />
              </div>
              <p className="text-2xl font-black text-fg">{card.value}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-6" aria-labelledby="recent-reports-heading">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="recent-reports-heading"
              className="text-base font-bold text-fg"
            >
              Recent reports
            </h2>
            <a
              href="/admin/reports"
              className="text-xs font-medium text-accent hover:underline"
            >
              View all
            </a>
          </div>
          {recentReports && recentReports.length > 0 ? (
            <ul className="divide-y divide-border">
              {recentReports.map((r: { id: string; target_type: string; reason: string | null; status: string; created_at: string }) => {
                  return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <span
                      className={`mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full ${
                        r.status === "open"
                          ? "bg-sale"
                          : r.status === "resolved"
                            ? "bg-success"
                            : "bg-text-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg">
                        <span className="font-medium capitalize">
                          {r.target_type}
                        </span>
                        {r.reason ? (
                          <span className="ml-1 text-text-muted">
                            · {r.reason.slice(0, 80)}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-text-muted">
                        {r.status} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                  </li>
                  );
                })}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">
              No reports yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}