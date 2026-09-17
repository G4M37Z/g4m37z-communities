// src/app/create/page.tsx
// Create hub. Previously "Create" jumped straight into the community form;
// this offers both things a member can create — a post or a community.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarPlus, FileText, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create",
  description: "Create a post, community, event, or tournament on G4M37Z.",
};

const OPTIONS = [
  {
    href: "/create/post",
    icon: FileText,
    title: "New post",
    description:
      "Share a thought, clip, or question with a community you belong to.",
  },
  {
    href: "/create/community",
    icon: Users,
    title: "New community",
    description:
      "Start a space for a game or squad. You become its admin.",
  },
  {
    href: "/events/new",
    icon: CalendarPlus,
    title: "New event",
    description:
      "Schedule an event in a community you run, or a standalone one.",
  },
  {
    href: "/tournaments/new",
    icon: Trophy,
    title: "New tournament",
    description:
      "Launch a tournament for a game. It starts in registration.",
  },
] as const;

export default async function CreateHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/create");
  }

  return (
    <main className="container-x py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Create
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            What do you want to make?
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map(({ href, icon: Icon, title, description }) => (
            <li key={href}>
              <Link
                href={href}
                className="press flex h-full min-h-[44px] flex-col gap-3 rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-border-strong hover:bg-surface-subtle"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft/40 text-accent-text">
                  <Icon size={20} />
                </span>
                <span className="text-lg font-semibold text-fg">{title}</span>
                <span className="text-sm text-text-secondary">{description}</span>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-accent-text">
                  Continue
                  <ArrowRight size={14} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
