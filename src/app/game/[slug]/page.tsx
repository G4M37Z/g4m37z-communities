/*
  Phase 2 — Game Detail Page (Gaming Graph hub)
  Displays a single game with its overview, communities, and basic metadata.
*/

export default async function GameDetailPage({ params }: { params: { slug: string } }) {
  return (
    <main className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">Game: {params.slug}</h1>
      <p className="mt-2 text-sm text-text-secondary">Game communities, discussions, reviews, guides, and LFG sessions will appear here (Phase 2-8).</p>
      <section className="mt-6 rounded-xl border border-border bg-surface p-8">
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="mt-2 text-sm text-text-secondary">Placeholder for game description, cover, genres, platforms, and statistics.</p>
      </section>
    </main>
  );
}
