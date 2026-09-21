// src/app/page.tsx
// G4M37Z Communities landing page. Server Component.
//
// Delivery: the hero and feature copy are static and flush immediately; the
// two DB-backed sections (your feed, newest communities) stream in behind
// Suspense boundaries so they never block first paint. The auth read is
// deduped with the root layout via getCurrentUser().

import { Suspense } from "react";
import Link from "next/link";
import { Users, MessageSquare, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/post/PostCard";
import { PageEnter } from "@/components/PageEnter";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandSignature } from "@/components/brand/BrandSignature";
import { getHomeFeed } from "@/lib/posts/queries";
import { getCurrentUser } from "@/lib/auth/current-user";

// The landing page is inherently per-request: the root layout reads auth, so
// this route is dynamic regardless. Mark it explicitly rather than relying on
// a build-time accident, and stream the DB-backed sections below.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Deduped: the root layout already awaited this in the same request.
  const { user } = await getCurrentUser();

  return (
    <>
      <Hero signedIn={!!user} />

      {/* Latest posts preview (signed in only) — streams in */}
      {user && (
        <Suspense fallback={<FeedSkeleton />}>
          <FeedPreview userId={user.id} />
        </Suspense>
      )}

      {/* Newest communities — public, streams in */}
      <Suspense fallback={<CommunitiesSkeleton />}>
        <NewestCommunities />
      </Suspense>

      {/* Features — static */}
      <section className="container-x py-14">
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

// Hero — the brand moment: mark settles, signature speaks, then copy.
function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="border-b border-border bg-surface">
      <div className="container-x py-20 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <BrandMark size={72} className="text-accent motion-safe:animate-[brand-settle_900ms_var(--ease-out)_both]" />
          <BrandSignature size="lg" className="mt-6 motion-safe:animate-[brand-reveal_700ms_var(--ease-out)_200ms_both]" />
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-fg sm:text-5xl md:text-6xl motion-safe:animate-[brand-reveal_700ms_var(--ease-out)_300ms_both]">
            Where your people play.
          </h1>
          <p className="mt-5 text-base text-text-secondary sm:text-lg motion-safe:animate-[brand-reveal_700ms_var(--ease-out)_380ms_both]">
            G4M37Z is where communities, creators, and culture meet the
            games you love. Find your people. Be found.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {signedIn ? (
              <Link
                href="/home"
                className="press inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Go to your feed
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="press inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Create your account
                </Link>
                <Link
                  href="/login"
                  className="press inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface"
                >
                  Sign in
                </Link>
              </>
            )}
            <Link
              href="/search"
              className="press inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface"
            >
              Search
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

async function FeedPreview({ userId }: { userId: string }) {
  const preview = await getHomeFeed(userId, "latest", 4);
  if (preview.length === 0) return null;

  return (
    <section className="container-x py-14">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="text-lg font-bold tracking-tight text-fg">
          Latest from your communities
        </h2>
        <Link
          href="/home"
          className="text-xs font-medium text-text-secondary transition-colors hover:text-fg"
        >
          See all →
        </Link>
      </header>
      <PageEnter stagger={0.06}>
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {preview.map((p) => (
            <li key={p.id}>
              <PostCard post={p} />
            </li>
          ))}
        </ul>
      </PageEnter>
    </section>
  );
}

async function NewestCommunities() {
  const supabase = await createClient();
  const { data: newest } = await supabase
    .from("communities")
    .select(
      "id, name, slug, description, icon_url, banner_url, creator_id, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(4);

  return (
    <section className="container-x py-14">
      <header className="mb-5 flex items-end justify-between">
        <h2 className="text-lg font-bold tracking-tight text-fg">
          Newest communities
        </h2>
        <Link
          href="/communities"
          className="text-xs font-medium text-text-secondary transition-colors hover:text-fg"
        >
          Browse all →
        </Link>
      </header>
      {newest && newest.length > 0 ? (
        <PageEnter stagger={0.06} y={10}>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map(
              (c: {
                id: string;
                name: string;
                slug: string;
                description: string | null;
              }) => (
                <li key={c.id}>
                  <Link
                    href={`/communities/${c.slug}`}
                    className="press block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-subtle"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="grid h-9 w-9 place-items-center rounded-md bg-accent-soft/40 text-sm font-bold text-accent-text"
                        aria-hidden="true"
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-fg">
                          {c.name}
                        </h3>
                        <p className="truncate text-[11px] text-text-muted">
                          /{c.slug}
                        </p>
                      </div>
                    </div>
                    {c.description && (
                      <p className="line-clamp-2 text-xs text-text-secondary">
                        {c.description}
                      </p>
                    )}
                  </Link>
                </li>
              )
            )}
          </ul>
        </PageEnter>
      ) : (
        <p className="text-sm text-text-secondary">
          No communities yet — be the first to{" "}
          <Link
            href="/communities"
            className="font-semibold text-accent-text hover:underline"
          >
            start one
          </Link>
          .
        </p>
      )}
    </section>
  );
}

function FeedSkeleton() {
  return (
    <section className="container-x py-14" aria-hidden="true">
      <div className="mb-5 h-5 w-64 skeleton" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-36 skeleton" />
        ))}
      </div>
    </section>
  );
}

function CommunitiesSkeleton() {
  return (
    <section className="container-x py-14" aria-hidden="true">
      <div className="mb-5 h-5 w-48 skeleton" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 skeleton" />
        ))}
      </div>
    </section>
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
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft/40 text-accent-text">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-semibold text-fg">{title}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}
