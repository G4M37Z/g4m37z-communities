// src/app/profile/[username]/page.tsx
// Public profile page with activity feed. Mobile-first responsive.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  title: string;
  created_at: string;
  comment_count: number;
  community: { slug: string; name: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return { title: "Profile · G4M37Z" };
  const p = profile as {
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  };
  const name = p.display_name ?? p.username;
  const description =
    p.bio?.slice(0, 160) ?? `${name} (@${p.username}) on G4M37Z Communities.`;
  return {
    title: `${name} (@${p.username})`,
    description,
    openGraph: {
      title: `${name} (@${p.username})`,
      description,
      type: "profile",
      siteName: "G4M37Z Communities",
      images: [p.avatar_url ?? "/icon.svg"],
    },
    twitter: {
      card: "summary",
      title: `${name} (@${p.username})`,
      description,
      images: [p.avatar_url ?? "/icon.svg"],
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    redirect("/search");
  }

  const profileData = profile as ProfileData;

  const [
    { data: postsData },
    { data: membershipsData },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, created_at, comment_count, community:communities!posts_community_id_fkey ( slug, name )")
      .eq("author_id", profileData.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("community_members")
      .select("community_id, role, joined_at, community:communities ( id, slug, name, icon_url )")
      .eq("user_id", profileData.id)
      .order("joined_at", { ascending: false })
      .limit(20),
  ]);

  const posts: PostRow[] = ((postsData ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    comment_count: number | null;
    community: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }>).map((p) => ({
    id: p.id,
    title: p.title,
    created_at: p.created_at,
    comment_count: p.comment_count ?? 0,
    community: Array.isArray(p.community) ? p.community[0] : p.community,
  }));

  const memberships: {
    community_id: string;
    role: string;
    joined_at: string;
    community: { id: string; slug: string; name: string; icon_url: string | null } | null;
  }[] = ((membershipsData ?? []) as Array<{
    community_id: string;
    role: string;
    joined_at: string;
    community: { id: string; slug: string; name: string; icon_url: string | null } | { id: string; slug: string; name: string; icon_url: string | null }[] | null;
  }>).map((m) => {
    const comm = Array.isArray(m.community) ? m.community[0] : m.community;
    return {
      community_id: m.community_id,
      role: m.role,
      joined_at: m.joined_at,
      community: comm,
    };
  });

  return (
    <main className="container-x py-8 pb-20">
      {/* Profile header — stacked on mobile, side-by-side on ≥640px */}
      <section className="mb-10 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="relative">
          {profileData.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileData.avatar_url}
              alt={`${profileData.display_name ?? profileData.username}'s avatar`}
              className="h-28 w-28 rounded-full border-2 border-border object-cover"
            />
          ) : (
            <div className="grid h-28 w-28 place-items-center rounded-full border-2 border-border bg-surface">
              <span className="text-4xl font-semibold text-accent">
                {profileData.display_name?.[0]?.toUpperCase() ??
                  profileData.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3 justify-center sm:justify-start">
            <h1 className="text-2xl font-bold text-fg sm:text-3xl">
              {profileData.display_name ?? profileData.username}
            </h1>
            <span className="text-sm text-text-muted">
              @{profileData.username}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-secondary">
            Member since{" "}
            {new Date(profileData.created_at).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </section>

      {/* Bio */}
      {profileData.bio && (
        <section className="mb-10 rounded-lg border border-border bg-surface p-6">
          <p className="text-base leading-relaxed text-fg whitespace-pre-wrap">
            {profileData.bio}
          </p>
        </section>
      )}

      {/* Posts — full-width cards, generous touch targets */}
      <section className="mb-10 rounded-lg border border-border bg-surface">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-fg">
            Posts ({posts.length})
          </h2>
        </header>
        {posts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-text-secondary">
              @{profileData.username} hasn&apos;t posted yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border" role="list">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/post/${p.id}`}
                  className="press block min-h-[48px] p-4 flex flex-col gap-1 transition-colors hover:bg-surface-subtle"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    {p.community && (
                      <>
                        <span className="font-medium text-fg">
                          {p.community.name}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{timeAgo(p.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {p.comment_count}{" "}
                      {p.comment_count === 1 ? "comment" : "comments"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-fg line-clamp-1">{p.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Communities — single column on mobile, two on tablet, touch-friendly cards */}
      <section className="rounded-lg border border-border bg-surface">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-fg">
            Communities ({memberships.length})
          </h2>
        </header>
        {memberships.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-text-secondary">
              @{profileData.username} hasn&apos;t joined any communities yet.
            </p>
          </div>
        ) : (
          <PageEnter stagger={0.04} y={8}>
            <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" role="list">
              {memberships.map((m) => {
                if (!m.community) return null;
                return (
                  <li key={m.community_id}>
                    <Link
                      href={`/communities/${m.community.slug}`}
                      className="press flex items-center gap-3 min-h-[52px] p-3 rounded-md border border-border bg-bg transition-colors hover:border-border-strong hover:bg-surface"
                    >
                      {m.community.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.community.icon_url}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-accent-soft/40 text-base font-semibold text-accent">
                          {m.community.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {m.community.name}
                        </p>
                        <p className="text-xs capitalize text-text-muted">
                          {m.role}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </PageEnter>
        )}
      </section>
    </main>
  );
}