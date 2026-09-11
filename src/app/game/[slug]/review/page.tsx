import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGameBySlug, getUserReviewsForGame } from "@/lib/games/service";
import { GameReviewForm } from "@/components/games/GameReviewForm";

export const dynamic = "force-dynamic";

export default async function GameReviewPage({
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
  if (!user) {
    redirect(`/login?next=/game/${slug}/review`);
  }

  const myReview = await getUserReviewsForGame(supabase, game.id, user.id);

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href={`/game/${slug}`}
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to {game.name}
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        {myReview ? "Edit your review" : `Review ${game.name}`}
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Rate {game.name} on gameplay, graphics, performance, story, audio, and
        value. You can post one review per game.
      </p>
      <GameReviewForm
        gameId={game.id}
        gameSlug={game.slug}
        gameName={game.name}
        existing={
          myReview
            ? {
                reviewId: myReview.id,
                gameplayScore: myReview.gameplay_score,
                graphicsScore: myReview.graphics_score,
                performanceScore: myReview.performance_score,
                storyScore: myReview.story_score,
                audioScore: myReview.audio_score,
                valueScore: myReview.value_score,
                overallScore: myReview.overall_score,
                body: myReview.body,
              }
            : null
        }
      />
    </main>
  );
}