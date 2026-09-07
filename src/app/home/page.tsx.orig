// src/app/home/page.tsx
// Authenticated home: shows posts from communities the user has joined
// (with a fallback to recent global posts when none are joined yet).

import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/supabase/actions";
import { PostCard } from "@/components/post/PostCard";
import { Pagination } from "@/components/Pagination";
import { PageEnter } from "@/components/PageEnter";
import { FeedSortTabs } from "./FeedSortTabs";
import { getHomeFeed, type SortKey } from "@/lib/posts/queries";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 30;

export const metadata = {
  title: "Home — G4M37Z Communities",
  description: "Your G4M37Z Communities home feed.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { page: pageParam, sort: sortParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const sort: SortKey =
    sortParam === "popular" || sortParam === "trending" ? sortParam : "latest";
  const offset = (page - 1) * PAGE_LIMIT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/home");
  }

  const [{ data: profile }, posts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    getHomeFeed(user.id, sort, PAGE_LIMIT, offset),
  ]);

  const { data: memberships } = await supabase
    .from("community_members")
    .select("community_id, joined_at, communities:community_id ( slug, name )")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(6);

  type Row = {
    community_id: string;
    communities: { slug: string; name: string } | { slug: string; name: string }[] | null;
  };
  const joined: { slug: string; name: string }[] = (
    (memberships ?? []) as Row[]
  )
    .map((m: Row) =>
      Array.isArray(m.communities) ? m.communities[0] : m.communities,
    )
    .filter(
      (c: { slug: string; name: string } | null | undefined): c is {
        slug: string;
        name: string;
      } => Boolean(c && typeof c === "object" && "slug" in c),
    );

  return (
    <main className="container-x py-8 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Welcome
            {profile?.display_name ? `, ${profile.display_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            @{profile?.username ?? user.email} ·{" "}
            {profile?.created_at
              ? `joined ${timeAgo(profile.created_at)}`
              : "Welcome to G4M37Z."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/create/post"
            className="press inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            New post
            <ArrowRight size={14} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="press inline-flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <FeedSortTabs current={sort} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-fg">
            {joined.length > 0 ? "Posts from your communities" : "Recent posts"}
          </h2>
          {posts.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-10 text-center">
              <h3 className="mb-1 text-sm font-semibold text-fg">
                Your feed is empty
              </h3>
              <p className="mb-4 text-sm text-text-secondary">
                Join a community to see its posts here, or browse for something interesting.
              </p>
              <Link
                href="/communities"
                className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Browse communities
              </Link>
            </div>
          ) : (
            <>
              <PageEnter stagger={0.04}>
                <ul className="space-y-3">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <PostCard post={p} />
                    </li>
                  ))}
                </ul>
              </PageEnter>
              <Pagination
                basePath="/home"
                page={page}
                limit={PAGE_LIMIT}
                hasMore={posts.length === PAGE_LIMIT}
                extraParams={{ sort }}
              />
            </>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
              Your communities
            </h3>
            {joined.length === 0 ? (
              <p className="text-sm text-text-secondary">
                You haven&apos;t joined any communities yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {joined.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/communities/${c.slug}`}
                      className="text-fg transition-colors hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/communities"
              className="mt-3 inline-block text-xs font-medium text-text-secondary transition-colors hover:text-fg"
            >
              Discover more →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}