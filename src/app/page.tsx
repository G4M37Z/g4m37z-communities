// src/app/page.tsx
// G4M37Z Communities landing page. Server Component.
//
// - Anonymous: hero + features + trending communities preview.
// - Authenticated: same hero, plus a "Latest from G4M37Z" posts preview so
//   signed-in users see real content right away.

import Link from "next/link";
import { Gamepad2, Users, MessageSquare, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/post/PostCard";
import { getHomeFeed } from "@/lib/posts/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch a preview (top 4) for each audience. Only one runs at a time.
  const preview = user
    ? await getHomeFeed(user.id, "latest", 4)
    : null;

  const { data: trendingRaw } = await supabase
    .from("communities")
    .select(
      "id, name, slug, description, icon_url, banner_url, creator_id, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(4);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="container-x py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <Gamepad2 size={14} />
              For players, by players
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-fg sm:text-5xl md:text-6xl">
              Where gamers gather.
            </h1>
            <p className="mt-4 text-base text-text-muted sm:text-lg">
              Discover communities for every game and platform. Share posts,
              join the conversation, and find your squad.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Link
                  href="/home"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Go to your feed
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    Create your account
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
                  >
                    Sign in
                  </Link>
                </>
              )}
              <Link
                href="/search"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
              >
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Latest posts preview (signed in only) */}
      {user && preview && preview.length > 0 && (
        <section className="container-x py-12">
          <header className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-black tracking-tight text-fg">
              Latest from your communities
            </h2>
            <Link
              href="/home"
              className="text-xs font-medium text-accent hover:underline"
            >
              See all →
            </Link>
          </header>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {preview.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Trending communities */}
      <section className="container-x py-12">
        <header className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-black tracking-tight text-fg">
            Newest communities
          </h2>
          <Link
            href="/communities"
            className="text-xs font-medium text-accent hover:underline"
          >
            Browse all →
          </Link>
        </header>
        {trendingRaw && trendingRaw.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {(trendingRaw ?? []).map((c: { id: string; name: string; slug: string; description: string | null }) => (
                        <li key={c.id}>
                          <Link
                            href={`/communities/${c.slug}`}
                            className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-sm font-black text-accent"
                                aria-hidden="true"
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-fg">
                                  {c.name}
                                </h3>
                                <p className="truncate text-[11px] text-text-muted">
                                  /{c.slug}
                                </p>
                              </div>
                            </div>
                            {c.description && (
                              <p className="line-clamp-2 text-xs text-text-muted">
                                {c.description}
                              </p>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
        ) : (
          <p className="text-sm text-text-muted">
            No communities yet — be the first to{" "}
            <Link
              href="/communities"
              className="font-semibold text-accent hover:underline"
            >
              start one
            </Link>
            .
          </p>
        )}
      </section>

      {/* Features */}
      <section className="container-x py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users size={20} />}
            title="Communities"
            body="Browse and join communities for every game, platform, and playstyle."
          />
          <FeatureCard
            icon={<MessageSquare size={20} />}
            title="Posts & comments"
            body="Share updates, discuss strategies, and reply in threaded conversations."
          />
          <FeatureCard
            icon={<ShieldCheck size={20} />}
            title="Moderated"
            body="Role-based moderation keeps discussions healthy and on-topic."
          />
        </div>
      </section>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-bold text-fg">{title}</h3>
      <p className="text-sm text-text-muted">{body}</p>
    </div>
  );
}