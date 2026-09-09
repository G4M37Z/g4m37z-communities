/*
  Phase 1 Week 3 — Game Discovery foundation
  Renders a list of games with basic filtering.
  Uses the games / genres / platforms tables created by Phase 1 SQL.
*/

export default async function DiscoverPage() {
  return (
    <main className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">Discover Games</h1>
      <p className="mt-2 text-sm text-text-secondary">Browse by genre, platform, or trending.</p>
      <section className="mt-8 rounded-xl border border-border bg-surface p-8">
        <p className="text-sm text-text-secondary">Game cards will render here using the gaming graph (Phase 2).</p>
      </section>
    </main>
  );
}
