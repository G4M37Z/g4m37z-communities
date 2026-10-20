import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Reveal } from "@/components/ui/reveal";

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
    <main className="container-x py-8 pb-20">
        <header className="mb-6 flex flex-col gap-3">
          <span className="flex items-center gap-2.5" aria-hidden="true">
            <span className="h-[3px] w-7 rounded-full bg-accent" />
            <span className="eyebrow text-xs text-accent-text">Creator Hub</span>
          </span>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-fg">Creators</h1>
            <span className="text-sm text-text-muted">
              {creators?.length ?? 0} {creators?.length === 1 ? "creator" : "creators"}
            </span>
          </div>
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
            <Link href="/login?next=/creators" className="underline text-accent-text">
              Sign in
            </Link>{" "}
            to apply as a creator.
          </p>
        )}

        {creators && creators.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {creators.map((c: { user_id: string; display_name: string; bio: string | null; verified: boolean; follower_count: number; total_content: number; created_at: string }, i: number) => (
              <li key={c.user_id}>
                <Reveal delay={Math.min(i, 8) * 0.04}>
                  <div className="card card-interactive p-4">
                    <Link
                      href={`/creators/${c.user_id}`}
                      className="text-base font-semibold text-fg hover:underline"
                    >
                      {c.display_name}
                      {c.verified && (
                        <VerifiedBadge size={13} className="ml-1.5" />
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
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <section className="card p-10 text-center">
            <h2 className="text-base font-semibold text-fg">No creators yet</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Be the first to apply as a creator.
            </p>
          </section>
        )}
      </main>
  );
}
