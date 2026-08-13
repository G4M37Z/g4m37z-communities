// src/app/home/page.tsx
// Protected landing page shown after login. Verifies the session is valid
// and surfaces the authenticated user's profile (read directly from the
// database — RLS enforces ownership/visibility rules).

import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/supabase/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home — G4M37Z Communities",
  description: "Your G4M37Z Communities home feed.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/home");
  }

  // Fetch the user's own profile. RLS policy allows SELECT for everyone.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="container-x py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-fg">
              Welcome
              {profile?.display_name ? `, ${profile.display_name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              You&apos;re signed in to G4M37Z Communities.
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm font-medium text-fg hover:border-accent hover:text-accent"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </form>
        </header>

        <section className="rounded-2xl border border-border bg-bg p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
              <UserIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg">Your profile</h2>
              <p className="text-xs text-text-muted">
                @{profile?.username ?? user.email}
              </p>
            </div>
          </div>

          {profile ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-text-muted">
                  Display name
                </dt>
                <dd className="text-sm font-medium text-fg">
                  {profile.display_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-text-muted">
                  Username
                </dt>
                <dd className="text-sm font-medium text-fg">
                  @{profile.username}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-text-muted">
                  Bio
                </dt>
                <dd className="text-sm font-medium text-fg">
                  {profile.bio ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-text-muted">
                  Member since
                </dt>
                <dd className="text-sm font-medium text-fg">
                  {new Date(profile.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-sale">
              We couldn&apos;t find your profile. Try signing out and back in.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-bg p-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-success" />
            <h2 className="text-base font-bold text-fg">
              You&apos;re authenticated
            </h2>
          </div>
          <p className="text-sm text-text-muted">
            Communities, posts, comments, and feeds will appear here in the next
            milestones. For now, this page verifies your session, profile
            loading, and sign-out flow.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-accent hover:underline"
            >
              Sign-in page
            </Link>
            <span className="text-text-muted">·</span>
            <Link
              href="/signup"
              className="text-sm font-medium text-accent hover:underline"
            >
              Sign-up page
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
