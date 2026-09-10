import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listLfgSessions } from "@/lib/lfg/service";
import { listGames, listPlatforms } from "@/lib/games/service";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Created",
  OPEN: "Open",
  FULL: "Full",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

function formatTime(t: string | null): string {
  if (!t) return "";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LfgDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    game?: string;
    platform?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const [games, platforms, sessions] = await Promise.all([
    listGames(supabase, { limit: 100 }),
    listPlatforms(supabase),
    listLfgSessions(supabase, {
      gameId: sp.game && /^[0-9a-f-]{36}$/i.test(sp.game) ? sp.game : undefined,
      platformId:
        sp.platform && /^[0-9a-f-]{36}$/i.test(sp.platform) ? sp.platform : undefined,
      // Only show open/created by default; user can opt into "show all".
      status: sp.status === "all" ? undefined : ["CREATED", "OPEN"],
      search: sp.q,
      limit: 30,
    }),
  ]);

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-fg">
              Looking For Group
            </h1>
            <span className="text-sm text-text-muted">
              {sessions.length} open {sessions.length === 1 ? "session" : "sessions"}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Find other players to team up with, or host your own session.
          </p>
          <div className="mt-2">
            {userData?.user ? (
              <Link
                href="/lfg/new"
                className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Host a session
              </Link>
            ) : (
              <Link
                href="/login?next=/lfg"
                className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
              >
                Sign in to host
              </Link>
            )}
          </div>
        </header>

        <form
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
          action="/lfg"
          method="get"
        >
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search mode / region / skill…"
            maxLength={64}
            aria-label="Search LFG sessions"
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
            name="platform"
            defaultValue={sp.platform ?? ""}
            aria-label="Filter by platform"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={sp.status ?? "open"}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="open">Open / Created</option>
            <option value="all">All (including closed)</option>
          </select>
          <button
            type="submit"
            className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Filter
          </button>
        </form>

        {sessions.length === 0 ? (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <h2 className="text-base font-semibold text-fg">
              No matching sessions
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Try a different game, platform, or search term.
            </p>
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/lfg/${s.id}`}
                    className="text-base font-semibold text-fg hover:underline"
                  >
                    {s.game_name ?? "Any game"}
                  </Link>
                  <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-text-secondary">
                  {s.mode && (
                    <div>
                      <dt className="text-text-muted">Mode</dt>
                      <dd className="text-fg">{s.mode}</dd>
                    </div>
                  )}
                  {s.region && (
                    <div>
                      <dt className="text-text-muted">Region</dt>
                      <dd className="text-fg">{s.region}</dd>
                    </div>
                  )}
                  {s.skill_level && (
                    <div>
                      <dt className="text-text-muted">Skill</dt>
                      <dd className="text-fg">{s.skill_level}</dd>
                    </div>
                  )}
                  {s.platform_name && (
                    <div>
                      <dt className="text-text-muted">Platform</dt>
                      <dd className="text-fg">{s.platform_name}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-text-muted">Players needed</dt>
                    <dd className="text-fg">{s.players_required}</dd>
                  </div>
                  {s.session_time && (
                    <div>
                      <dt className="text-text-muted">Session</dt>
                      <dd className="text-fg">{formatTime(s.session_time)}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-xs text-text-muted">
                  Host:{" "}
                  <span className="text-fg">
                    {s.host_display_name ?? s.host_username ?? "—"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageEnter>
  );
}
