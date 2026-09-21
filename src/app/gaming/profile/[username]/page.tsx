// ============================================================================
// src/app/gaming/profile/[username]/page.tsx
// Public gaming profile — answers at a glance: who is this gamer, what do
// they play, what are they playing now, which platforms, and what you can
// do with them (follow / message — real actions only). Rows render only if
// the 052 visibility RLS let them through; the owner sees everything.
// ============================================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername } from "@/lib/profiles/username";
import { listUserGames, listGameIdentities, getGamingVisibility } from "@/lib/gaming/service";
import { listPlatformLinks, PLATFORM_LABELS } from "@/lib/profiles/platform-links";
import { PlatformIcon } from "@/components/platform-icon";
import { PLATFORMS, type Platform } from "@/lib/profiles/platforms";
import { GameCover } from "@/components/games/GameCover";
import { GameStatusBadge } from "@/components/gaming/GameStatusBadge";
import { FollowButton } from "@/components/profile/FollowButton";
import { PageEnter } from "@/components/PageEnter";
import type { GameStatus } from "@/lib/gaming/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  const name =
    (profile as { display_name: string | null; username: string } | null)?.display_name ??
    profile?.username;
  if (!name) return { title: "Gaming profile · G4M37Z" };
  return {
    title: `${name} gaming profile`,
    description: `Games, platforms, and in-game identities for ${name} on G4M37Z.`,
  };
}

const SECTIONS: { status: GameStatus; title: string }[] = [
  { status: "playing", title: "Currently playing" },
  { status: "favorite", title: "Favorites" },
  { status: "owned", title: "Owned" },
  { status: "want_to_play", title: "Want to play" },
  { status: "followed", title: "Following" },
];

export default async function GamingProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, gaming_visibility")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (!profile) notFound();

  const gamer = profile as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    gaming_visibility: string;
  };

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwn = viewer?.id === gamer.id;
  if (gamer.gaming_visibility === "private" && !isOwn) notFound();

  let isFollowing = false;
  if (viewer && !isOwn) {
    const { data: edge } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewer.id)
      .eq("followed_id", gamer.id)
      .maybeSingle();
    isFollowing = Boolean(edge);
  }

  const [library, identities, links, visibility] = await Promise.all([
    listUserGames(gamer.id),
    listGameIdentities(gamer.id),
    listPlatformLinks(gamer.id),
    getGamingVisibility(gamer.id),
  ]);

  const isHidden = !isOwn && visibility === "followers" && !isFollowing;
  const sections = SECTIONS.map((s) => ({
    ...s,
    rows: library.filter((r) => r.status === s.status),
  })).filter((s) => s.rows.length > 0);

  const name = gamer.display_name ?? gamer.username;

  return (
    <main className="container-x py-8">
      <PageEnter>
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-surface">
            {gamer.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gamer.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent/10 text-xl font-bold text-accent-text">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black tracking-tight text-fg">{name}</h1>
            <Link
              href={`/profile/${encodeURIComponent(gamer.username)}`}
              className="text-sm text-accent-text hover:underline"
            >
              @{gamer.username} · full profile →
            </Link>
          </div>
          {!isOwn && viewer && (
            <div className="flex items-center gap-2">
              <FollowButton targetUserId={gamer.id} initialFollowing={isFollowing} />
              <Link
                href="/messages/new"
                className="press inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-fg transition-colors hover:border-accent"
              >
                Message
              </Link>
            </div>
          )}
          {isOwn && (
            <Link
              href="/gaming"
              className="press inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-fg transition-colors hover:border-accent"
            >
              Edit gaming profile
            </Link>
          )}
        </header>

        {isHidden ? (
          <section className="brand-card p-10 text-center">
            <h2 className="text-base font-semibold text-fg">This gaming profile is limited</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Follow {name} to see their games and in-game identities.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            {links.length > 0 && (
              <section className="brand-card p-6">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                  Platforms
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {links.map((l) => (
                    <li
                      key={l.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-fg"
                    >
                      <PlatformIcon platform={l.platform} />
                      <span className="font-medium">{l.handle}</span>
                      <span className="text-xs text-text-muted">{PLATFORM_LABELS[l.platform]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sections.length > 0 ? (
              sections.map((s) => (
                <section key={s.status} className="brand-card p-6">
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                    {s.title}
                  </h2>
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {s.rows.map((row) => (
                      <li key={row.id} className="min-w-0">
                        <div className="w-20">
                          <GameCover
                            title={row.game?.name ?? "Game"}
                            url={row.game?.cover_url ?? null}
                          />
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-fg">
                          {row.game?.name ?? "Unknown game"}
                        </p>
                        <GameStatusBadge status={row.status} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <section className="brand-card p-10 text-center">
                <h2 className="text-base font-semibold text-fg">No games yet</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {isOwn
                    ? "Add games from your gaming console."
                    : `${name} hasn't added any games yet.`}
                </p>
              </section>
            )}

            {identities.length > 0 && (
              <section className="brand-card p-6">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                  In-game identities
                </h2>
                <ul className="divide-y divide-border">
                  {identities.map((ident) => (
                    <li key={ident.id} className="flex items-center gap-3 py-3">
                      <span className="w-10 shrink-0">
                        <GameCover
                          title={ident.game?.name ?? "Game"}
                          url={ident.game?.cover_url ?? null}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">
                          {ident.game?.name ?? "Unknown game"}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {ident.in_game_name}
                          {ident.rank_label ? ` · ${ident.rank_label}` : ""}
                          {ident.region ? ` · ${ident.region}` : ""}
                        </p>
                      </div>
                      {ident.platform_slug &&
                        ((PLATFORMS as readonly string[]).includes(ident.platform_slug) ? (
                          <PlatformIcon platform={ident.platform_slug as Platform} />
                        ) : (
                          <span className="text-xs font-medium text-text-muted">
                            {ident.platform_slug}
                          </span>
                        ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </PageEnter>
    </main>
  );
}
