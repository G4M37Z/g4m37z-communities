import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGames } from "@/lib/games/service";
import { FrameworkBuilder } from "@/components/tournaments/FrameworkBuilder";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create framework — G4M37Z Communities",
  description: "Define a custom tournament framework with stages and progression rules.",
};

export default async function NewFrameworkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/tournaments/frameworks/new");
  }

  const games = await listGames(supabase, { limit: 100 });

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/tournaments/new"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to create tournament
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-fg">
        Create a tournament framework
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Define a competition pipeline — stages, points, and who advances — that
        any organiser can then attach to a tournament. Bind it to a game to
        give that game its own way of gaming.
      </p>
      <div className="mt-6">
        <FrameworkBuilder
          games={games.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>
    </main>
  );
}