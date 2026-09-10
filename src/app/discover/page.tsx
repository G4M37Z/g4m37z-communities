import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/types/database";
export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: games } = await supabase.from("games").select("*").limit(12);
  return (
    <main className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">Discover Games</h1>
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(games ?? []).map((g: Game) => (
          <a key={g.id} href={`/game/${g.slug}`} className="block rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong">
            <h3 className="font-semibold text-fg">{g.name}</h3>
            <p className="text-xs text-text-secondary">{g.description}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
