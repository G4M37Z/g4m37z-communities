// src/app/saved/page.tsx
// Private saved-content page. RLS scopes bookmarks to the owner; a signed-out
// visitor is redirected to login. Empty state encourages discovering content.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listSavedPosts } from "@/lib/bookmarks/service";
import { PostCard } from "@/components/post/PostCard";
import { Pagination } from "@/components/Pagination";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved — G4M37Z Communities",
  description: "Posts you saved for later. Private to you.",
};

const PAGE_LIMIT = 30;

export default async function SavedPage({
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
  if (!user) redirect("/login?next=/saved");

  const { items, total } = await listSavedPosts(PAGE_LIMIT, offset);

  const hasMore = total !== null ? offset + items.length < total : items.length === PAGE_LIMIT;

  return (
    <main className="container-x py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
          Saved
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {total === 1
            ? "1 post saved. Only you can see this list."
            : `${total ?? items.length} posts saved. Only you can see this list.`}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <Bookmark
            size={32}
            className="mx-auto mb-3 text-text-muted"
            aria-hidden="true"
          />
          <h2 className="mb-1 text-base font-bold text-fg">
            Nothing saved yet
          </h2>
          <p className="mx-auto mb-5 max-w-sm text-sm text-text-muted">
            Bookmark posts to find them here — your list is private and only
            visible to you.
          </p>
          <Link
            href="/home"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Browse your feed
          </Link>
          </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="relative">
                <span
                  className="absolute right-3 top-3 z-10 text-xs text-text-muted"
                  title={`Saved ${timeAgo(p.saved_at)}`}
                >
                  saved {timeAgo(p.saved_at)}
                </span>
                <PostCard
                  post={{
                    id: p.id,
                    author_id: "",
                    community_id: "",
                    title: p.title,
                    body: p.body,
                    image_url: p.image_url,
                    created_at: p.created_at,
                    updated_at: p.created_at,
                    comment_count: p.comment_count,
                    score: 0,
                    author: {
                      username: p.author?.username ?? "",
                      display_name: p.author?.display_name ?? null,
                      avatar_url: null,
                    },
                    community: p.community,
                    signed_in: true,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Pagination page={page} limit={PAGE_LIMIT} hasMore={hasMore} basePath="/saved" />
          </div>
        </>
      )}
    </main>
  );
}
