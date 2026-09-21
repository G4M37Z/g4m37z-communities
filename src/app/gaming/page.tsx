// ============================================================================
// src/app/gaming/page.tsx
// The signed-in user's gaming console: library manager, per-game identity
// editor, platform links, visibility control. Data comes from the gaming
// service (052 RLS: an owner always sees their own rows).
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listUserGames, listGameIdentities, getGamingVisibility } from "@/lib/gaming/service";
import { listPlatformLinks, PLATFORM_LABELS } from "@/lib/profiles/platform-links";
import { PlatformIcon } from "@/components/platform-icon";
import { GameCover } from "@/components/games/GameCover";
import { LibraryManager } from "@/components/gaming/LibraryManager";
import { IdentityManager } from "@/components/gaming/IdentityManager";
import { VisibilitySelect } from "@/components/gaming/VisibilitySelect";
import { GameStatusBadge } from "@/components/gaming/GameStatusBadge";
import { PageEnter } from "@/components/PageEnter";
import type { GamingVisibility } from "@/lib/gaming/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "My gaming profile" };

export default async function GamingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gaming");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const username = (profile as { username: string } | null)?.username ?? "";

  const [library, identities, visibility, links] = await Promise.all([
    listUserGames(user.id),
    listGameIdentities(user.id),
    getGamingVisibility(user.id),
    listPlatformLinks(user.id),
  ]);

  const sections = LIBRARY_SECTIONS.filter((s) =>
    library.some((row) => row.status === s.status),
  );

  return (
    <main className="container-x py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-fg">My gaming profile</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Build your library, add in-game identities, and control who sees them.
        </p>
      </header>

      <PageEnter>
        <div className="space-y-6">
          <section className="brand-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-fg">Visibility</h2>
              <Link
                href={`/gaming/profile/${encodeURIComponent(username)}`}
                className="text-xs font-semibold text-accent-text hover:underline"
              >
                View public page →
              </Link>
            </div>
            <VisibilitySelect initial={visibility as GamingVisibility} />
          </section>

          <section className="brand-card p-6">
            <h2 className="mb-4 text-base font-semibold text-fg">Game library</h2>
            {sections.length > 0 ? (
              <div className="mb-6 space-y-5">
                {sections.map((s) => (
                  <div key={s.status}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                      {s.title}
                    </h3>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {library
                        .filter((row) => row.status === s.status)
                        .map((row) => (
                          <li key={row.id} className="min-w-0">
                            <Link href={`/discover`} className="block" aria-label={row.game?.name}>
                              <div className="w-20">
                                <GameCover
                                  title={row.game?.name ?? "Game"}
                                  url={row.game?.cover_url ?? null}
                                />
                              </div>
                            </Link>
                            <p className="mt-1 truncate text-xs font-medium text-fg">
                              {row.game?.name ?? "Unknown game"}
                            </p>
                            <GameStatusBadge status={row.status} />
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-6 text-sm text-text-secondary">
                Your library is empty — search a game below to add your first one.
              </p>
            )}
            <LibraryManager existing={library} />
          </section>

          <section className="brand-card p-6">
            <h2 className="mb-4 text-base font-semibold text-fg">In-game identities</h2>
            <IdentityManager existing={identities} />
          </section>

          <section className="brand-card p-6">
            <h2 className="mb-1 text-base font-semibold text-fg">Platform handles</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Manage your Steam, PlayStation, Xbox and mobile handles in Settings.
            </p>
            {links.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <li
                    key={l.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-fg"
                  >
                    <PlatformIcon platform={l.platform} />
                    <span className="font-medium">{l.handle}</span>
                    <span className="text-xs text-text-muted">
                      {PLATFORM_LABELS[l.platform]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Link
                href="/settings"
                className="press inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-semibold text-fg transition-colors hover:border-accent"
              >
                Add a platform handle
              </Link>
            )}
          </section>
        </div>
      </PageEnter>
    </main>
  );
}

const LIBRARY_SECTIONS: { status: import("@/lib/gaming/types").GameStatus; title: string }[] = [
  { status: "playing", title: "Playing" },
  { status: "favorite", title: "Favorites" },
  { status: "owned", title: "Owned" },
  { status: "want_to_play", title: "Want to play" },
  { status: "followed", title: "Following" },
];

