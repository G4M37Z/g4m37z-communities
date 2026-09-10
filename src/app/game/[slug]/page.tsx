import { createClient } from "@/lib/supabase/server";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("*").eq("slug", slug).maybeSingle();
  if (!game) return <main className="container-x py-10"><h1 className="text-3xl font-bold">Game not found</h1></main>;
  return (
    <main className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
      <p className="mt-2 text-sm text-text-secondary">{game.description}</p>
      <section className="mt-6 rounded-xl border border-border bg-surface p-8">
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="mt-2 text-sm text-text-secondary">Game ID: {game.id} · Released: {game.release_date}</p>
      </section>
    </main>
  );
}
