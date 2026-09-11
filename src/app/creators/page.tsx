import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: creators } = await supabase
    .from("creator_profiles")
    .select("user_id, display_name, bio, verified, follower_count, total_content, created_at")
    .order("follower_count", { ascending: false })
    .limit(50);

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-6 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Creators</h1>
          <span className="text-sm text-text-muted">
            {creators?.length ?? 0} {creators?.length === 1 ? "creator" : "creators"}
          </span>
        </header>

        {user ? (
          <Link
            href="/creators/new"
            className="mb-6 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Apply as creator
          </Link>
        ) : (
          <p className="mb-6 text-sm text-text-secondary">
            <Link href="/login?next=/creators" className="underline text-accent">
              Sign in
            </Link>{" "}
            to apply as a creator.
          </p>
        )}

        {creators && creators.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {creators.map((c: { user_id: string; display_name: string; bio: string | null; verified: boolean; follower_count: number; total_content: number; created_at: string }) => (
              <li
                key={c.user_id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <Link
                  href={`/creators/${c.user_id}`}
                  className="text-base font-semibold text-fg hover:underline"
                >
                  {c.display_name}
                  {c.verified && (
                    <span className="ml-1.5 text-accent">✓</span>
                  )}
                </Link>
                {c.bio && (
                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                    {c.bio}
                  </p>
                )}
                <dl className="mt-2 flex gap-4 text-[10px] uppercase tracking-wider text-text-muted">
                  <div>
                    <dt>Followers</dt>
                    <dd className="text-xs font-semibold text-fg">{c.follower_count}</dd>
                  </div>
                  <div>
                    <dt>Content</dt>
                    <dd className="text-xs font-semibold text-fg">{c.total_content}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <h2 className="text-base font-semibold text-fg">No creators yet</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Be the first to apply as a creator.
            </p>
          </section>
        )}
      </main>
    </PageEnter>
  );
}
