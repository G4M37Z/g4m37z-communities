import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  listTournaments,
  getTeamCount,
  TOURNAMENT_STATUSES,
  type TournamentStatus,
} from "@/lib/tournaments/service";
import { listGames } from "@/lib/games/service";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION: "Registration",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function TournamentsDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; game?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const defaultStatuses: TournamentStatus[] = ["REGISTRATION", "IN_PROGRESS"];
  const statusRequested =
    sp.status === "all"
      ? TOURNAMENT_STATUSES.filter((s) => s !== "CANCELLED")
      : defaultStatuses;

  const games = await listGames(supabase, { limit: 100 });
  const tournaments = await listTournaments(supabase, {
    search: sp.q,
    status: statusRequested,
    limit: 30,
  });

  // Fetch team counts separately so we can render "team_count".
  const enrichedTournaments = await Promise.all(
    tournaments.map(async (t) => ({
      ...t,
      team_count: await getTeamCount(supabase, t.id),
    })),
  );

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-fg">
              Tournaments
            </h1>
            <span className="text-sm text-text-muted">
              {enrichedTournaments.length}{" "}
              {enrichedTournaments.length === 1 ? "tournament" : "tournaments"}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Community-organised brackets and tournaments. Find an active one
            or register your team.
          </p>
          <div className="mt-2">
            {userData?.user ? (
              <Link
                href="/tournaments/new"
                className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Create tournament
              </Link>
            ) : (
              <Link
                href="/login?next=/tournaments"
                className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
              >
                Sign in to create
              </Link>
            )}
          </div>
        </header>

        <form
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
          action="/tournaments"
          method="get"
        >
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search tournaments…"
            maxLength={64}
            aria-label="Search tournaments"
            className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <select
            name="game"
            defaultValue={sp.game ?? ""}
            aria-label="Filter by game"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={sp.status ?? "open"}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="open">Open</option>
            <option value="all">All (including closed)</option>
          </select>
          <button
            type="submit"
            className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Filter
          </button>
        </form>

        {enrichedTournaments.length === 0 ? (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <h2 className="text-base font-semibold text-fg">
              No matching tournaments
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Try a different search term or status filter.
            </p>
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {enrichedTournaments.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/tournaments/${t.id}`}
                    className="text-base font-semibold text-fg hover:underline"
                  >
                    {t.name}
                  </Link>
                  <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-text-secondary">
                  {t.game_name && (
                    <div>
                      <dt className="text-text-muted">Game</dt>
                      <dd className="text-fg">{t.game_name}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-text-muted">Format</dt>
                    <dd className="text-fg capitalize">
                      {t.format.toLowerCase().replace("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Teams</dt>
                    <dd className="text-fg">
                      {t.team_count} / {t.max_teams}
                    </dd>
                  </div>
                  {t.event_title && (
                    <div>
                      <dt className="text-text-muted">Event</dt>
                      <dd className="text-fg">{t.event_title}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageEnter>
  );
}
