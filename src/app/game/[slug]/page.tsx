import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";
import {
  getGameBySlug,
  getGameGenres,
  getGamePlatforms,
  getGameFollowerCount,
  isFollowingGame,
  listGameReviews,
  getUserReviewsForGame,
} from "@/lib/games/service";
import { FollowGameButton } from "@/components/games/FollowGameButton";

export const dynamic = "force-dynamic";

function formatDate(d: string | null): string {
  if (!d) return "Unknown";
  return new Date(d).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const game = await getGameBySlug(supabase, slug);
  if (!game) {
    return (
      <main className="container-x py-10">
        <h1 className="text-3xl font-bold tracking-tight">Game not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          We couldn&apos;t find a game at <code>/game/{slug}</code>.
        </p>
        <Link
          href="/discover"
          className="press mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Browse Discover
        </Link>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [genres, platforms, followerCount, following, reviews, myReview] =
    await Promise.all([
      getGameGenres(supabase, game.id),
      getGamePlatforms(supabase, game.id),
      getGameFollowerCount(supabase, game.id),
      isFollowingGame(supabase, game.id, user?.id ?? null),
      listGameReviews(supabase, game.id, { limit: 10 }),
      user
        ? getUserReviewsForGame(supabase, game.id, user.id)
        : Promise.resolve(null),
    ]);

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-fg">
              {game.name}
            </h1>
            <span className="text-sm text-text-muted">
              Released {formatDate(game.release_date)}
            </span>
          </div>
          {game.description && (
            <p className="text-base text-text-secondary">{game.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {user ? (
              <FollowGameButton
                gameId={game.id}
                initiallyFollowing={following}
              />
            ) : (
              <Link
                href={`/login?next=/game/${game.slug}`}
                className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
              >
                Sign in to follow
              </Link>
            )}
            <span
              className="text-xs text-text-secondary"
              data-testid="game-followers-count"
            >
              {followerCount.toLocaleString()}{" "}
              {followerCount === 1 ? "follower" : "followers"}
            </span>
          </div>
        </header>

        {(genres.length > 0 || platforms.length > 0) && (
          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {genres.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="text-xs uppercase tracking-wider text-text-muted">
                  Genres
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <span
                      key={g.id}
                      className="rounded-md border border-border bg-bg px-3 py-1 text-xs text-fg"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {platforms.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="text-xs uppercase tracking-wider text-text-muted">
                  Platforms
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <span
                      key={p.id}
                      className="rounded-md border border-border bg-bg px-3 py-1 text-xs text-fg"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mb-10 rounded-lg border border-border bg-surface">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-base font-semibold text-fg">
              Reviews ({reviews.length})
            </h2>
            {user && (
              <Link
                href={`/game/${game.slug}/review`}
                className="press inline-flex h-9 items-center rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                {myReview ? "Edit your review" : "Write a review"}
              </Link>
            )}
          </header>
          {reviews.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-text-secondary">
              No reviews yet. Be the first to share your thoughts.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {reviews.map((r) => (
                <li key={r.id} className="px-4 py-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-fg">
                      {r.author_display_name ??
                        r.author_username ??
                        "Gamer"}
                    </span>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                  {typeof r.overall_score === "number" && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Overall score:{" "}
                      <span className="font-semibold text-fg">
                        {r.overall_score}
                      </span>
                      /100
                    </p>
                  )}
                  {r.body && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-fg">
                      {r.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </PageEnter>
  );
}
