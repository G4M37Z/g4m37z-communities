// src/app/create/post/page.tsx
// Create a new post in a community the user has joined.
// Auth-gated via proxy.ts.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreatePostForm } from "./CreatePostForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create post",
  description: "Share a post with a G4M37Z community.",
};

export default async function CreatePostPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const { community: communitySlugParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/create/post");

  // List communities the user has joined.
  const { data: memberships } = await supabase
    .from("community_members")
    .select(
      "community_id, communities:community_id ( id, slug, name )"
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  type JoinedRow = {
    community_id: string;
    communities:
      | { id: string; slug: string; name: string }
      | { id: string; slug: string; name: string }[]
      | null;
  };

  const joined: { id: string; slug: string; name: string }[] = (
    (memberships ?? []) as JoinedRow[]
  )
    .map((m) =>
      Array.isArray(m.communities) ? m.communities[0] : m.communities
    )
    .filter(
      (c): c is { id: string; slug: string; name: string } =>
        Boolean(c && typeof c === "object" && "id" in c)
    );

  // Pick the preselected community from ?community=<slug>.
  const preselected =
    (communitySlugParam &&
      joined.find((c) => c.slug === communitySlugParam)?.id) ||
    joined[0]?.id ||
    "";

  return (
    <main className="container-x py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Create a post
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Share a tip, a question, or a clip with your community.
          </p>
        </header>

        {joined.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="mb-2 text-base font-bold text-fg">
              Join a community first
            </h2>
            <p className="mb-4 text-sm text-text-muted">
              You need to join at least one community before you can post.
            </p>
            <Link
              href="/communities"
              className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Browse communities
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <CreatePostForm
              communities={joined}
              defaultCommunityId={preselected}
            />
          </div>
        )}
      </div>
    </main>
  );
}