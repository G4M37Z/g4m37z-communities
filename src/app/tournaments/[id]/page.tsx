import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getTournament,
  listTeams,
  listMatches,
  getTeamCount,
  getResultForMatch,
  listDisputes,
} from "@/lib/tournaments/service";
import { TournamentRegisterButton } from "@/components/tournaments/TournamentRegisterButton";
import { TournamentOrgControls } from "@/components/tournaments/TournamentOrgControls";
import { TournamentDisputeForm } from "@/components/tournaments/TournamentDisputeForm";
import { TournamentResolveButton } from "@/components/tournaments/TournamentResolveButton";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  REGISTRATION: "Registration",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const tournament = await getTournament(supabase, id);
  if (!tournament) {
    return (
      <main className="container-x py-10">
        <h1 className="text-3xl font-bold tracking-tight">Tournament not found</h1>
        <Link
          href="/tournaments"
          className="press mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Browse tournaments
        </Link>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  // Determine whether the current user is the tournament organiser
  // (community creator of the event). Mirrors isTournamentOrganiser in
  // the service.
  let isOrganiser = false;
  let myTeamId: string | null = null;
  if (userId && tournament.event_id) {
    const { data: ev } = await supabase
      .from("events")
      .select("community_id")
      .eq("id", tournament.event_id)
      .maybeSingle();
    if (ev) {
      const communityId = (ev as { community_id: string | null }).community_id;
      if (communityId) {
        const { data: comm } = await supabase
          .from("communities")
          .select("creator_id")
          .eq("id", communityId)
          .maybeSingle();
        if (comm && (comm as { creator_id: string }).creator_id === userId) {
          isOrganiser = true;
        }
      }
    }
  }

  const [teamCount, teams, matches] = await Promise.all([
    getTeamCount(supabase, tournament.id),
    listTeams(supabase, tournament.id),
    listMatches(supabase, tournament.id),
  ]);

  // Discover the captain's own team (if they're registered as captain).
  if (userId) {
    const myTeam = teams.find((t) => t.captain_id === userId);
    if (myTeam) myTeamId = myTeam.id;
  }

  // Fetch results + disputes for each match (organiser-only display).
  const matchDetails = await Promise.all(
    matches.map(async (m) => ({
      ...m,
      result: await getResultForMatch(supabase, m.id),
      disputes: await listDisputes(supabase, m.id),
    })),
  );

  // Group matches by round for the bracket display.
  const roundsMap = new Map<number, typeof matchDetails>();
  for (const m of matchDetails) {
    const r = m.round ?? 0;
    if (!roundsMap.has(r)) roundsMap.set(r, []);
    roundsMap.get(r)!.push(m);
  }
  const roundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  const registrationOpen =
    tournament.status === "REGISTRATION" &&
    (tournament.max_teams === 0 || teamCount < tournament.max_teams);

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/tournaments"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to tournaments
      </Link>
      <header className="mb-6 mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            {tournament.name}
          </h1>
          <span
            className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted"
            data-testid="tournament-status"
          >
            {STATUS_LABELS[tournament.status] ?? tournament.status}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {tournament.game_name && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">
                Game
              </dt>
              <dd className="text-fg">{tournament.game_name}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted">
              Format
            </dt>
            <dd className="text-fg capitalize">
              {tournament.format.toLowerCase().replace("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-muted">
              Teams
            </dt>
            <dd className="text-fg" data-testid="tournament-team-count">
              {teamCount} / {tournament.max_teams}
            </dd>
          </div>
          {tournament.event_title && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">
                Event
              </dt>
              <dd className="text-fg">{tournament.event_title}</dd>
            </div>
          )}
        </dl>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!userId ? (
            <Link
              href={`/login?next=/tournaments/${tournament.id}`}
              className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
            >
              Sign in to register
            </Link>
          ) : isOrganiser ? (
            <span className="text-sm text-text-secondary">
              You are the tournament organiser.
            </span>
          ) : myTeamId ? (
            <span className="rounded-md border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
              You are registered with team {teams.find((t) => t.id === myTeamId)?.name}.
            </span>
          ) : (
            <TournamentRegisterButton
              tournamentId={tournament.id}
              disabled={!registrationOpen}
              disabledReason={
                tournament.status !== "REGISTRATION"
                  ? `Tournament is ${tournament.status.toLowerCase()}`
                  : `Tournament is full`
              }
            />
          )}
          {isOrganiser && (
            <TournamentOrgControls
              tournamentId={tournament.id}
              currentStatus={tournament.status}
            />
          )}
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg">
            Teams ({teamCount})
          </h2>
        </header>
        {teams.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            No teams registered yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {teams.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm text-fg">
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg">
            Bracket ({matchDetails.length} {matchDetails.length === 1 ? "match" : "matches"})
          </h2>
        </header>
        {matchDetails.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            Bracket will appear once the organiser generates matches.
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {roundNumbers.map((roundNum) => (
              <div key={roundNum}>
                <h3 className="mb-2 text-xs uppercase tracking-wider text-text-muted">
                  Round {roundNum + 1}
                </h3>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(roundsMap.get(roundNum) ?? []).map((m) => (
                    <li
                      key={m.id}
                      className="rounded-md border border-border bg-bg p-3"
                    >
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-text-muted">
                          {MATCH_STATUS_LABELS[m.status] ?? m.status}
                        </span>
                        {m.scheduled_time && (
                          <span className="text-text-muted">
                            {new Date(m.scheduled_time).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                        <span
                          className={
                            "truncate " +
                            (m.winner_id && m.winner_id === m.team_a_id
                              ? "font-bold text-fg"
                              : "text-fg")
                          }
                        >
                          {m.team_a_name ?? "—"}
                        </span>
                        <span className="text-xs text-text-muted">vs</span>
                        <span
                          className={
                            "truncate text-right " +
                            (m.winner_id && m.winner_id === m.team_b_id
                              ? "font-bold text-fg"
                              : "text-fg")
                          }
                        >
                          {m.team_b_name ?? "—"}
                        </span>
                      </div>
                      {m.winner_name && (
                        <p className="mt-2 text-xs uppercase tracking-wider text-success">
                          Winner: {m.winner_name}
                        </p>
                      )}
                      {m.disputes.length > 0 && (
                        <p className="mt-2 text-xs text-sale">
                          {m.disputes.length} dispute
                          {m.disputes.length === 1 ? "" : "s"}
                        </p>
                      )}
                      {(isOrganiser || userId) && m.status !== "CANCELLED" && (
                        <div className="mt-3 space-y-2 border-t border-border pt-2">
                          {userId && (
                            <TournamentDisputeForm matchId={m.id} />
                          )}
                          {isOrganiser && m.disputes.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                                Open disputes
                              </p>
                              {m.disputes
                                .filter((d) => d.status === "PENDING")
                                .map((d) => (
                                  <div
                                    key={d.id}
                                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface p-2 text-xs"
                                  >
                                    <p className="flex-1 truncate">
                                      {d.reason ?? "—"}
                                    </p>
                                    <TournamentResolveButton disputeId={d.id} />
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
