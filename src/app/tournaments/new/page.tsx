import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import { listFrameworks } from "@/lib/tournaments/frameworks-service";
import { TournamentCreateForm } from "@/components/tournaments/TournamentCreateForm";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/tournaments/new");
  }

  const [games, frameworks] = await Promise.all([
    listGames(supabase, { limit: 100 }),
    listFrameworks(supabase),
  ]);

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/tournaments"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to tournaments
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        Create a tournament
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Tournaments are organised by community owners. New tournaments
        start in REGISTRATION.
      </p>
      <TournamentCreateForm
        games={games.map((g) => ({
          id: g.id,
          name: g.name,
          default_framework_id: g.default_framework_id,
        }))}
        frameworks={frameworks}
      />
    </main>
  );
}
