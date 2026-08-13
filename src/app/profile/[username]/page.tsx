// src/app/profile/[username]/page.tsx
// Public profile page. Shows the user's display name, bio, avatar,
// and a feed of their posts/comments (when implemented).

import { redirect } from "next/navigation";
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

export const metadata = {
  title: "Profile",
  description: "User profile on G4M37Z Communities.",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();

  // Fetch the profile by username
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    redirect("/search");
  }

  // Fetch posts by this user (for future Milestone 4+)
  // const { data: posts } = await supabase
  //   .from("posts")
  //   .select("id, title, community_id, created_at")
  //   .eq("author_id", profile.id)
  //   .order("created_at", { ascending: false })
  //   .limit(20);

  // Fetch communities the user is a member of (for future Milestone 3+)
  // const { data: memberships } = await supabase
  //   .from("community_members")
  //   .select("community_id, role, joined_at, communities (id, name, slug, icon_url)")
  //   .eq("user_id", profile.id)
  //   .limit(10);

  return (
    <main className="container-x py-12 max-w-3xl">
      {/* Profile header */}
      <section className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-6">
        <div className="relative">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${profile.display_name ?? profile.username}'s avatar`}
              className="h-28 w-28 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-28 w-28 rounded-full bg-accent/10 flex items-center justify-center border-2 border-border">
              <span className="text-4xl font-black text-accent">
                {profile.display_name?.[0]?.toUpperCase() ?? profile.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-fg">
              {profile.display_name ?? profile.username}
            </h1>
            <span className="text-base font-mono text-text-muted">
              @{profile.username}
            </span>
          </div>
          <p className="mt-2 text-sm text-text-muted">
            Member since {new Date(profile.created_at).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </section>

      {/* Bio */}
      {profile.bio && (
        <section className="mb-8 rounded-2xl border border-border bg-bg p-6">
          <p className="text-base text-fg whitespace-pre-wrap">{profile.bio}</p>
        </section>
      )}

      {/* Future: Posts tab */}
      <section className="rounded-2xl border border-border bg-bg p-6">
        <h2 className="mb-4 text-base font-semibold text-fg">Activity</h2>
        <p className="text-sm text-text-muted">
          Posts and comments will appear here once you start participating in communities.
        </p>
      </section>

      {/* Future: Communities tab */}
      <section className="mt-6 rounded-2xl border border-border bg-bg p-6">
        <h2 className="mb-4 text-base font-semibold text-fg">Communities</h2>
        <p className="text-sm text-text-muted">
          Joined communities will be listed here.
        </p>
      </section>
    </main>
  );
}
