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
import { getHomeFeed } from "@/lib/posts/queries";
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
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const offset = (page - 1) * PAGE_LIMIT;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/home");
  }

  // Fetch the user's own profile + joined communities + posts in parallel.
  const [{ data: profile }, posts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    getHomeFeed(user.id, "latest", PAGE_LIMIT, offset),
  ]);

  // Joined community ids for the right-side list.
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
      .map((m: Row) => {
        return Array.isArray(m.communities) ? m.communities[0] : m.communities;
      })
      .filter(
        (c: { slug: string; name: string } | null | undefined): c is {
          slug: string;
          name: string;
        } => Boolean(c && typeof c === "object" && "slug" in c)
      );

  return (
    <main className="container-x py-8 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
            Welcome
            {profile?.display_name ? `, ${profile.display_name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            @{profile?.username ?? user.email} ·{" "}
            {profile?.created_at
              ? `joined ${timeAgo(profile.created_at)}`
              : "Welcome to G4M37Z."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/create/post"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            New post
            <ArrowRight size={14} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-fg hover:border-accent hover:text-accent"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-bold text-fg">
            {joined.length > 0 ? "Posts from your communities" : "Recent posts"}
          </h2>
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <h3 className="mb-1 text-sm font-bold text-fg">
                Your feed is empty
              </h3>
              <p className="mb-4 text-sm text-text-muted">
                Join a community to see its posts here, or browse for something interesting.
              </p>
              <Link
                href="/communities"
                className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Browse communities
              </Link>
            </div>
          ) : (
                      <>
                        <ul className="space-y-4">
                          {posts.map((p) => (
                            <li key={p.id}>
                              <PostCard post={p} />
                            </li>
                          ))}
                        </ul>
                        <Pagination
                          basePath="/home"
                          page={page}
                          limit={PAGE_LIMIT}
                          hasMore={posts.length === PAGE_LIMIT}
                        />
                      </>
                    )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-fg">
              Your communities
            </h3>
            {joined.length === 0 ? (
              <p className="text-sm text-text-muted">
                You haven&apos;t joined any communities yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {joined.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/communities/${c.slug}`}
                      className="text-fg hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/communities"
              className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
            >
              Discover more →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}