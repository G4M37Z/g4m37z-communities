// src/app/profile/[username]/page.tsx
// Public profile page with activity feed (user's posts, joined communities).

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";

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

interface MembershipRow {
  community_id: string;
  role: string;
  joined_at: string;
  community: { id: string; slug: string; name: string; icon_url: string | null } | { id: string; slug: string; name: string; icon_url: string | null }[] | null;
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

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    redirect("/search");
  }

  const profileData = profile as ProfileData;

  // Fetch user's posts and community memberships in parallel
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

  const posts: PostRow[] = (postsData ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    created_at: p.created_at,
    comment_count: p.comment_count ?? 0,
    community: Array.isArray(p.community) ? p.community[0] : p.community,
  }));

  const memberships: { community_id: string; role: string; joined_at: string; community: { id: string; slug: string; name: string; icon_url: string | null } | null }[] = (membershipsData ?? []).map((m: any) => {
    const comm = Array.isArray(m.community) ? m.community[0] : m.community;
    return {
      community_id: m.community_id,
      role: m.role,
      joined_at: m.joined_at,
      community: comm,
    };
  });

  return (
    <main className="container-x py-12 max-w-3xl">
      {/* Profile header */}
      <section className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6">
        <div className="relative">
          {profileData.avatar_url ? (
            <img
              src={profileData.avatar_url}
              alt={`${profileData.display_name ?? profileData.username}'s avatar`}
              className="h-28 w-28 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-accent/10 flex items-center justify-center border-2 border-border">
              <span className="text-4xl font-black text-accent">
                {profileData.display_name?.[0]?.toUpperCase() ?? profileData.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-fg">
              {profileData.display_name ?? profileData.username}
            </h1>
            <span className="text-base font-mono text-text-muted">
              @{profileData.username}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-muted">
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
        <section className="mb-8 rounded-2xl border border-border bg-bg p-6">
          <p className="text-base text-fg whitespace-pre-wrap">{profileData.bio}</p>
        </section>
      )}

      {/* Posts */}
      <section className="mb-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-bold text-fg">
          Posts ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-text-muted">
            @{profileData.username} hasn't posted yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id} className="py-3">
                <Link
                  href={`/post/${p.id}`}
                  className="block hover:text-accent transition-colors"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
                    {p.community && (
                      <>
                        <span className="font-semibold text-fg">
                          {p.community.name}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{timeAgo(p.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {p.comment_count} {p.comment_count === 1 ? "comment" : "comments"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-fg">{p.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Communities */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-bold text-fg">
          Communities ({memberships.length})
        </h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-text-muted">
            @{profileData.username} hasn't joined any communities yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {memberships.map((m) => {
              if (!m.community) return null;
              return (
                <li key={m.community_id}>
                  <Link
                    href={`/communities/${m.community.slug}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-bg p-3 transition-colors hover:border-accent"
                  >
                    {m.community.icon_url ? (
                      <img
                        src={m.community.icon_url}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-sm font-black text-accent">
                        {m.community.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">
                        {m.community.name}
                      </p>
                      <p className="text-xs text-text-muted capitalize">
                        {m.role}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}