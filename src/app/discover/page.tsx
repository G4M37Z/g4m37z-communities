import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import { GameCover } from "@/components/games/GameCover";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover games",
  description:
    "Browse the G4M37Z game catalogue — official cover art for the titles your communities play.",
  openGraph: {
    title: "Discover games · G4M37Z",
    description:
      "Browse the G4M37Z game catalogue — official cover art for the titles your communities play.",
    siteName: "G4M37Z Communities",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover games · G4M37Z",
    images: ["/og.png"],
  },
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const games = await listGames(supabase, {
    search: q,
    limit: 24,
  });

  return (
    <main className="container-x py-8 pb-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-fg">
          Discover Games
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Browse the catalogue, search by name, or open a game to follow and
          review.
        </p>
        <form className="mt-4 flex gap-2" action="/discover" method="get">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search games…"
            maxLength={64}
            aria-label="Search games"
            className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Search
          </button>
        </form>
      </header>

      {games.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-10 text-center">
          <h2 className="text-base font-semibold text-fg">No games found</h2>
          <p className="mt-2 text-sm text-text-secondary">
            The catalogue is empty or your search did not match any titles.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <Link
              key={g.id}
              href={`/game/${g.slug}`}
              className="block rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <GameCover title={g.name} url={g.cover_url} />
              <h3 className="mt-3 text-base font-semibold text-fg">{g.name}</h3>
              {g.description && (
                <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                  {g.description}
                </p>
              )}
              {g.release_date && (
                <p className="mt-2 text-[10px] text-text-muted uppercase tracking-wider">
                  Released {new Date(g.release_date).getFullYear()}
                </p>
              )}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
