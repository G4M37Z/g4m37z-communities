import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import { listPlatforms } from "@/lib/games/service";
import { LfgCreateForm } from "@/components/lfg/LfgCreateForm";

export const dynamic = "force-dynamic";

export default async function LfgNewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/lfg/new`);
  }

  const [games, platforms] = await Promise.all([
    listGames(supabase, { limit: 100 }),
    listPlatforms(supabase),
  ]);

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/lfg"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to sessions
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        Host a session
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Set the game, platform, and how many players you need.
      </p>
      <LfgCreateForm
        games={games.map((g) => ({ id: g.id, name: g.name }))}
        platforms={platforms.map((p) => ({ id: p.id, name: p.name }))}
      />
    </main>
  );
}
