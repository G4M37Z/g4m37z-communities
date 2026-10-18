// src/components/landing/ScrollStory.tsx
// The signed-out story scroll (user direction, 2026-10-18): before the visitor
// starts navigating they scroll through what the site actually gives them —
// a PS-store-style rail of tiles, a how-it-works run, and a final CTA band.
// Static content only (no DB) so it paints instantly; motion comes from the
// shared Reveal primitive (scroll reveals, reduced-motion safe).

import Link from "next/link";
import {
  Users,
  Gamepad2,
  Calendar,
  UserPlus,
  Mic,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const TILES = [
  {
    icon: Users,
    title: "Communities",
    body: "Join or run your people's hub — posts, roles, moderation, invites.",
    kicker: "01",
  },
  {
    icon: Gamepad2,
    title: "Games & discover",
    body: "Follow the games you play; discover communities around every title.",
    kicker: "02",
  },
  {
    icon: Calendar,
    title: "Events & tournaments",
    body: "RSVP to community events. Enter brackets with your team.",
    kicker: "03",
  },
  {
    icon: UserPlus,
    title: "LFG",
    body: "Post a 'looking for group' with region, skill and platform — get picked up.",
    kicker: "04",
  },
  {
    icon: Mic,
    title: "Voice rooms & calls",
    body: "Community voice rooms plus direct one-to-one calls with video.",
    kicker: "05",
  },
  {
    icon: MessagesSquare,
    title: "Messages",
    body: "DMs with attachments, reactions and call logs in one thread.",
    kicker: "06",
  },
  {
    icon: Sparkles,
    title: "Creators",
    body: "Verified creators with their own hub — follow, keep up, get drops.",
    kicker: "07",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Claim your tag",
    body: "One account carries your profile, platform links and follow list.",
  },
  {
    n: "02",
    title: "Join your people",
    body: "Find communities by game and platform — or start your own.",
  },
  {
    n: "03",
    title: "Play like you're on the couch",
    body: "Post, party up, jump in voice, run your tournament bracket.",
  },
];

export function ScrollStory() {
  return (
    <>
      {/* The shelf — PS store rail of what the site gives, snapped per tile */}
      <section className="container-x pt-16 pb-8">
        <span className="flex items-center gap-2.5" aria-hidden="true">
          <span className="h-[3px] w-7 rounded-full bg-accent" />
          <span className="eyebrow text-xs text-accent-text">What&apos;s inside</span>
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          Everything your squad needs to stay in one place.
        </h2>
        <ul
          className="mt-8 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 snap-x snap-mandatory sm:mx-0 sm:px-0"
          aria-label="What G4M37Z includes"
        >
          {TILES.map(({ icon: Icon, title, body, kicker }, i) => (
            <li
              key={title}
              className="w-64 shrink-0 snap-start sm:w-72"
            >
              <Reveal delay={Math.min(i, 6) * 0.05}>
                <div className="card card-interactive flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft/50 text-accent-text">
                      <Icon size={20} />
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-display text-sm font-black text-text-muted"
                    >
                      {kicker}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {body}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <span className="text-xs text-text-muted sm:hidden">
          swipe →
        </span>
      </section>

      {/* How it works */}
      <section className="hero-ps border-y border-border">
        <div className="container-x py-16">
          <span className="flex items-center gap-2.5" aria-hidden="true">
            <span className="h-[3px] w-7 rounded-full bg-accent" />
            <span className="eyebrow text-xs text-accent-text">How it works</span>
          </span>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ n, title, body }, i) => (
              <li key={n}>
                <Reveal delay={Math.min(i, 4) * 0.07}>
                  <div className="card h-full p-6">
                    <span
                      aria-hidden="true"
                      className="font-display text-5xl font-black leading-none text-accent-text"
                    >
                      {n}
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-fg">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                      {body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-x py-16">
        <Reveal>
          <div className="hero-ps mx-auto max-w-3xl rounded-2xl border border-border px-6 py-14 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
              Start where your people play.
            </h2>
            <p className="mt-3 text-sm text-text-secondary sm:text-base">
              Free to join. Built and moderated by the community itself.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/signup"
                className="press inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Create your account
              </Link>
              <Link
                href="/communities"
                className="press inline-flex h-11 items-center rounded-md border border-border bg-bg px-5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface"
              >
                Explore communities
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
