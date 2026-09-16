import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCreatorAnalytics } from "@/lib/creators/analytics";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creator analytics — G4M37Z" };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-fg">{value}</p>
    </div>
  );
}

export default async function CreatorAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageEnter>
        <main className="container-x py-8">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Creator analytics</h1>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/login?next=/settings/analytics" className="text-accent-text underline">
              Sign in
            </Link>{" "}
            to view your creator analytics.
          </p>
        </main>
      </PageEnter>
    );
  }

  // Creator status is opt-in: analytics belong to members who explicitly
  // applied (a creator_profiles row). Everyone else gets the opt-in path.
  const { data: creatorRow } = await supabase
    .from("creator_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!creatorRow) {
    return (
      <PageEnter>
        <main className="container-x py-8">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Creator analytics</h1>
          <div className="mt-4 max-w-md rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-fg">You&apos;re not a creator yet</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Analytics are part of the creator toolkit. Applying is free and
              doesn&apos;t change your regular account — it&apos;s your choice.
            </p>
            <Link
              href="/creators/new"
              className="press mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Apply as a creator
            </Link>
          </div>
        </main>
      </PageEnter>
    );
  }

  const result = await getCreatorAnalytics(user.id, user.id);
  if (!result.ok) {
    return (
      <PageEnter>
        <main className="container-x py-8">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Creator analytics</h1>
          <p className="mt-4 text-sm text-red">{result.error}</p>
        </main>
      </PageEnter>
    );
  }

  const a = result.analytics;

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Creator analytics</h1>
          <p className="mt-1 text-xs text-text-muted">
            Real platform signals · trailing {a.window_days}-day engagement window
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Followers" value={a.followers} />
          <Stat
            label="Follower growth (30d)"
            value={a.follower_growth_30d >= 0 ? `+${a.follower_growth_30d}` : a.follower_growth_30d}
          />
          <Stat label="Posts published" value={a.posts_published} />
          <Stat label="Posts (30d)" value={a.posts_last_30d} />
          <Stat label="Total score" value={a.total_score} />
          <Stat label="Total comments" value={a.total_comments} />
          <Stat label="Total reposts" value={a.total_reposts} />
          <Stat
            label="Engagement / post (30d)"
            value={a.engagement_rate_30d === null ? "—" : a.engagement_rate_30d.toFixed(1)}
          />
        </section>

        <h2 className="mt-8 mb-3 text-lg font-bold text-fg">Top posts</h2>
        {a.top_posts.length === 0 ? (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <p className="text-sm text-text-secondary">
              No posts yet. Publish your first post to see engagement here.
            </p>
            <Link
              href="/create/post"
              className="press mt-4 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Create a post
            </Link>
          </section>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {a.top_posts.map((p) => (
              <li key={p.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <Link href={`/post/${p.id}`} className="min-w-0 flex-1 truncate font-semibold text-fg hover:text-accent-text">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-text-muted">
                  {p.score} score · {p.comments} comments · {p.reposts} reposts
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-xs text-text-muted">
          Views/impressions are not yet measurable in the current architecture and are
          intentionally not displayed.
        </p>
      </main>
    </PageEnter>
  );
}
