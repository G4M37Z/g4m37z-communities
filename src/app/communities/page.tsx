// src/app/communities/page.tsx
// Browse communities. Public route — anyone can read.
// Server Component. Loads communities + member counts + categories server-side.

import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Community, CommunityCategory } from "@/types/database";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Communities",
  description: "Browse gaming communities on G4M37Z.",
};

type CommunityRow = Community & {
  member_count?: number;
  category_names?: string[];
};

export default async function CommunitiesPage() {
  const supabase = await createClient();

  // Pull communities ordered by recency.
  const { data: communitiesRaw } = await supabase
    .from("communities")
    .select("id, name, slug, description, icon_url, banner_url, creator_id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(60);

  const communities: CommunityRow[] = communitiesRaw ?? [];

  // Member counts: one count query per community is N+1 — we instead fetch
  // a single grouped count and merge client-side.
  const { data: counts } = await supabase
    .from("community_members")
    .select("community_id");
  const memberCounts = new Map<string, number>();
  if (counts) {
    for (const row of counts as { community_id: string }[]) {
      memberCounts.set(row.community_id, (memberCounts.get(row.community_id) ?? 0) + 1);
    }
  }
  for (const c of communities) c.member_count = memberCounts.get(c.id) ?? 0;

  // Categories per community.
  const communityIds = communities.map((c) => c.id);
  let categoryByCommunity = new Map<string, string[]>();
  if (communityIds.length > 0) {
    const { data: links } = await supabase
      .from("community_category_links")
      .select("community_id, category_id");
    const { data: allCategories } = await supabase
      .from("community_categories")
      .select("id, slug, name");
    const catById = new Map<string, CommunityCategory>();
    for (const cat of (allCategories ?? []) as CommunityCategory[]) {
      catById.set(cat.id, cat);
    }
    categoryByCommunity = new Map();
    for (const link of (links ?? []) as { community_id: string; category_id: string }[]) {
      const cat = catById.get(link.category_id);
      if (!cat) continue;
      const list = categoryByCommunity.get(link.community_id) ?? [];
      list.push(cat.name);
      categoryByCommunity.set(link.community_id, list);
    }
    for (const c of communities) {
      c.category_names = categoryByCommunity.get(c.id) ?? [];
    }
  }

  return (
    <main className="container-x py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Communities
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Find your squad. Discover communities for every game and platform.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Create community
          <ArrowRight size={16} />
        </Link>
      </header>

      {communities.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <li key={c.id}>
              <CommunityCard community={c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CommunityCard({ community }: { community: CommunityRow }) {
  return (
    <Link
      href={`/communities/${community.slug}`}
      className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent"
    >
      <div className="mb-3 flex items-center gap-3">
        <CommunityIcon name={community.name} url={community.icon_url} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-fg">
            {community.name}
          </h2>
          <p className="truncate text-xs text-text-muted">
            /{community.slug}
          </p>
        </div>
      </div>

      {community.description && (
        <p className="mb-3 line-clamp-2 text-sm text-text-muted">
          {community.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {community.member_count ?? 0} members
        </span>
        <span>created {timeAgo(community.created_at)}</span>
      </div>

      {community.category_names && community.category_names.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {community.category_names.slice(0, 3).map((name) => (
            <span
              key={name}
              className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function CommunityIcon({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      // External user-uploaded image — no known dimensions for next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-10 w-10 rounded-full border border-border object-cover"
      />
    );
  }
  const initial = name.charAt(0).toUpperCase();
  return (
    <span
      className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-base font-black text-accent"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-12 text-center">
      <Users size={36} className="mx-auto mb-4 text-text-muted" />
      <h2 className="mb-2 text-lg font-bold text-fg">No communities yet</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-text-muted">
        Be the first to start one. Communities are where players gather for
        specific games, platforms, and topics.
      </p>
      <Link
        href="/create"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
      >
        Create the first community
      </Link>
    </div>
  );
}
