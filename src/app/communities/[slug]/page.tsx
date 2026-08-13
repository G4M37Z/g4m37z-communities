// src/app/communities/[slug]/page.tsx
// Single community view: banner, description, member count, join/leave button.
// Server Component — fetches community + current user's membership.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Community, CommunityCategory } from "@/types/database";
import { JoinLeaveButton } from "./JoinLeaveButton";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase
    .from("communities")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();
  if (!community) return { title: "Community not found" };
  return {
    title: `${(community as { name: string }).name} · Communities`,
    description:
      (community as { description: string | null }).description ??
      `Join ${(community as { name: string }).name} on G4M37Z Communities.`,
  };
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: communityRaw } = await supabase
    .from("communities")
    .select(
      "id, name, slug, description, icon_url, banner_url, creator_id, created_at, updated_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!communityRaw) notFound();
  const community = communityRaw as Community;

  // Member count + current user's membership + categories — fetched in parallel.
  const [
    { count: memberCount },
    { data: { user } },
    { data: linksRaw },
    { data: categoriesRaw },
  ] = await Promise.all([
    supabase
      .from("community_members")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", community.id),
    supabase.auth.getUser(),
    supabase
      .from("community_category_links")
      .select("category_id")
      .eq("community_id", community.id),
    supabase.from("community_categories").select("id, slug, name"),
  ]);

  let currentRole: "member" | "moderator" | "admin" | null = null;
  if (user) {
    const { data: myMembership } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", community.id)
      .eq("user_id", user.id)
      .maybeSingle();
    currentRole = (myMembership as { role: typeof currentRole } | null)?.role ?? null;
  }

  const catById = new Map<string, CommunityCategory>();
  for (const c of (categoriesRaw ?? []) as CommunityCategory[]) {
    catById.set(c.id, c);
  }
  const categoryNames = ((linksRaw ?? []) as { category_id: string }[])
    .map((l) => catById.get(l.category_id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <main className="container-x py-8 sm:py-10">
      <Link
        href="/communities"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted hover:text-fg"
      >
        <ArrowLeft size={14} />
        All communities
      </Link>

      <header className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <Banner url={community.banner_url} name={community.name} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 text-2xl font-black tracking-tight text-fg sm:text-3xl">
              {community.name}
            </h1>
            <p className="text-xs text-text-muted">/{community.slug}</p>
            {community.description && (
              <p className="mt-3 max-w-2xl text-sm text-text-muted">
                {community.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-muted">
              <Users size={14} />
              {memberCount ?? 0} members
            </span>
            {user ? (
              <JoinLeaveButton
                communityId={community.id}
                currentRole={currentRole}
              />
            ) : (
              <Link
                href={`/login?next=/communities/${community.slug}`}
                className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Sign in to join
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-2 text-base font-bold text-fg">Posts</h2>
            <p className="text-sm text-text-muted">
              Posts arrive in Milestone 4. For now, this is the community hub.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-fg">
              About
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Created</dt>
                <dd className="text-fg">{timeAgo(community.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Members</dt>
                <dd className="text-fg">{memberCount ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Your role</dt>
                <dd className="text-fg">{currentRole ?? "—"}</dd>
              </div>
            </dl>
          </div>

          {categoryNames.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-fg">
                Categories
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {categoryNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] uppercase tracking-wider text-text-muted"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function Banner({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // External user-uploaded image — no known dimensions for next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-32 w-full object-cover sm:h-44"
      />
    );
  }
  return (
    <div
      className="h-32 w-full sm:h-44"
      style={{
        background:
          "linear-gradient(135deg, #1f2937 0%, #0b0d12 60%, #312e81 100%)",
      }}
      aria-label={`${name} banner`}
    />
  );
}
