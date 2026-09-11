import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageEnter>
        <main className="container-x py-8 pb-20">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Social</h1>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/login?next=/social" className="underline text-accent">
              Sign in
            </Link>{" "}
            to see your social graph.
          </p>
        </main>
      </PageEnter>
    );
  }

  const [
    { data: following },
    { data: followers },
    { data: blocked },
    { data: notificationEvents },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("followed_id, followed_at")
      .eq("follower_id", user.id)
      .order("followed_at", { ascending: false })
      .limit(50),
    supabase
      .from("follows")
      .select("follower_id, followed_at")
      .eq("followed_id", user.id)
      .order("followed_at", { ascending: false })
      .limit(50),
    supabase
      .from("blocks")
      .select("blocked_id, blocked_at")
      .eq("blocker_id", user.id)
      .order("blocked_at", { ascending: false })
      .limit(50),
    supabase
      .from("notification_events")
      .select("id, event_type, source_type, source_id, delivered, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allIds = [
    ...new Set([
      ...((following ?? []).map((f: { followed_id: string }) => f.followed_id) as string[]),
      ...((followers ?? []).map((f: { follower_id: string }) => f.follower_id) as string[]),
      ...((blocked ?? []).map((b: { blocked_id: string }) => b.blocked_id) as string[]),
    ]),
  ];

  const profileMap = new Map<string, { username: string }>();
  if (allIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", allIds);
    (data ?? []).forEach((p: { id: string; username: string }) =>
      profileMap.set(p.id, { username: p.username }),
    );
  }

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <h1 className="text-3xl font-bold tracking-tight text-fg mb-6">Social</h1>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-fg mb-2">Following</h2>
          {following && following.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {following.map((f: { followed_id: string; followed_at: string }) => (
                <li key={f.followed_id}>
                  <Link
                    href={`/profile/${profileMap.get(f.followed_id)?.username}`}
                    className="rounded-md border border-border bg-surface px-3 py-1 text-xs text-fg hover:border-border-strong"
                  >
                    {profileMap.get(f.followed_id)?.username ?? "Unknown"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Not following anyone yet.</p>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-fg mb-2">Followers</h2>
          {followers && followers.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {followers.map((f: { follower_id: string; followed_at: string }) => (
                <li key={f.follower_id}>
                  <Link
                    href={`/profile/${profileMap.get(f.follower_id)?.username}`}
                    className="rounded-md border border-border bg-surface px-3 py-1 text-xs text-fg hover:border-border-strong"
                  >
                    {profileMap.get(f.follower_id)?.username ?? "Unknown"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No followers yet.</p>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-fg mb-2">Blocked</h2>
          {blocked && blocked.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {blocked.map((b: { blocked_id: string; blocked_at: string }) => (
                <li key={b.blocked_id}>
                  <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs text-text-muted">
                    {profileMap.get(b.blocked_id)?.username ?? "Unknown"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No one blocked.</p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-fg mb-2">Recent events</h2>
          {notificationEvents && notificationEvents.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {notificationEvents.map((ev: { id: string; event_type: string; source_type: string; source_id: string; delivered: boolean; read: boolean; created_at: string }) => (
                <li key={ev.id} className="px-4 py-2 text-sm">
                  <span className="font-medium text-fg">{ev.event_type}</span>
                  <span className="ml-2 text-xs text-text-muted">
                    {ev.source_type}
                  </span>
                  {!ev.read && (
                    <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      new
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No recent events.</p>
          )}
        </section>
      </main>
    </PageEnter>
  );
}
