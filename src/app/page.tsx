// src/app/page.tsx
// G4M37Z Communities landing page. Server Component.
//
// Lists feature blocks (auth-aware CTA), and stubs the upcoming
// feed/community discovery sections until later milestones land.

import Link from "next/link";
import { Gamepad2, Users, MessageSquare, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="container-x py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
              <Gamepad2 size={14} />
              For players, by players
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-fg sm:text-5xl md:text-6xl">
              Where gamers gather.
            </h1>
            <p className="mt-4 text-base text-text-muted sm:text-lg">
              Discover communities for every game and platform. Share posts,
              join the conversation, and find your squad.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Link
                  href="/home"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Go to your feed
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                  >
                    Create your account
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container-x py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users size={20} />}
            title="Communities"
            body="Browse and join communities for every game, platform, and playstyle."
            available={false}
          />
          <FeatureCard
            icon={<MessageSquare size={20} />}
            title="Posts & comments"
            body="Share updates, discuss strategies, and reply in threaded conversations."
            available={false}
          />
          <FeatureCard
            icon={<ShieldCheck size={20} />}
            title="Moderated"
            body="Role-based moderation keeps discussions healthy and on-topic."
            available={false}
          />
        </div>

        <p className="mt-10 text-center text-sm text-text-muted">
          Communities, posts, comments, and feeds ship in upcoming milestones.
        </p>
      </section>
    </>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  available,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  available: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <h3 className="mb-1 text-base font-bold text-fg">{title}</h3>
      <p className="text-sm text-text-muted">{body}</p>
      {!available && (
        <p className="mt-4 text-xs uppercase tracking-wider text-text-muted">
          Coming soon
        </p>
      )}
    </div>
  );
}
