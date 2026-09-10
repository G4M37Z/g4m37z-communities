import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getLfgSession,
  getLfgParticipantCount,
  listLfgParticipants,
  getMyParticipation,
} from "@/lib/lfg/service";
import { LfgJoinLeaveButton } from "@/components/lfg/LfgJoinLeaveButton";
import { LfgHostControls } from "@/components/lfg/LfgHostControls";

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
  if (!t) return "—";
  return new Date(t).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LfgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getLfgSession(supabase, id);
  if (!session) {
    return (
      <main className="container-x py-10">
        <h1 className="text-3xl font-bold tracking-tight">Session not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The session may have been closed or removed.
        </p>
        <Link
          href="/lfg"
          className="press mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Browse sessions
        </Link>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const [participantCount, participants, myParticipation] = await Promise.all([
    getLfgParticipantCount(supabase, session.id),
    listLfgParticipants(supabase, session.id),
    getMyParticipation(supabase, session.id, userId),
  ]);

  const isHost = !!userId && userId === session.host_id;
  const isParticipant = !!myParticipation;
  const isFull = participantCount >= session.players_required;
  const isClosed =
    session.status === "CLOSED" ||
    session.status === "CANCELLED" ||
    session.status === "COMPLETED" ||
    session.status === "EXPIRED";
  const isUnavailable = isClosed || session.status === "FULL";

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/lfg"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to sessions
      </Link>
      <header className="mb-6 mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            {session.game_name ?? "Any game"}
          </h1>
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
            {STATUS_LABELS[session.status] ?? session.status}
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          Hosted by{" "}
          <span className="font-semibold text-fg">
            {session.host_display_name ?? session.host_username ?? "—"}
          </span>
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {session.mode && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Mode
              </dt>
              <dd className="text-fg">{session.mode}</dd>
            </div>
          )}
          {session.region && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Region
              </dt>
              <dd className="text-fg">{session.region}</dd>
            </div>
          )}
          {session.skill_level && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Skill
              </dt>
              <dd className="text-fg">{session.skill_level}</dd>
            </div>
          )}
          {session.platform_name && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Platform
              </dt>
              <dd className="text-fg">{session.platform_name}</dd>
            </div>
          )}
          {session.language && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Language
              </dt>
              <dd className="text-fg">{session.language}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Session time
            </dt>
            <dd className="text-fg">{formatTime(session.session_time)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Players
            </dt>
            <dd
              className="text-fg"
              data-testid="lfg-participant-count"
            >
              {participantCount} / {session.players_required}
              {session.microphone_required && (
                <span className="ml-2 rounded-md border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                  Mic required
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Privacy
            </dt>
            <dd className="text-fg capitalize">{session.privacy}</dd>
          </div>
        </dl>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!userId ? (
            <Link
              href={`/login?next=/lfg/${session.id}`}
              className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
            >
              Sign in to join
            </Link>
          ) : isHost ? (
            <span className="text-sm text-text-secondary">
              You are the host.
            </span>
          ) : (
            <LfgJoinLeaveButton
              sessionId={session.id}
              initiallyParticipant={isParticipant}
              disabled={isUnavailable}
              disabledReason={
                session.status === "FULL" || isFull
                  ? "Session is full"
                  : isClosed
                    ? `Session is ${session.status.toLowerCase()}`
                    : null
              }
            />
          )}
          {isHost && !isClosed && (
            <LfgHostControls sessionId={session.id} />
          )}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg">
            Participants ({participantCount})
          </h2>
        </header>
        {participants.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            No participants yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {participants.map((p) => (
              <li
                key={`${p.session_id}-${p.user_id}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="text-sm font-semibold text-fg">
                  {p.display_name ?? p.username ?? "Gamer"}
                </span>
                <span className="text-xs text-text-muted">
                  joined {new Date(p.joined_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
