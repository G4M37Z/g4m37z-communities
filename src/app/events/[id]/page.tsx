import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getEvent,
  getEventParticipantCount,
  listEventParticipants,
  getMyRsvp,
} from "@/lib/events/service";
import { EventRsvpButton } from "@/components/events/EventRsvpButton";
import { EventHostControls } from "@/components/events/EventHostControls";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  FULL: "Full",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

function formatWhen(t: string | null): string {
  if (!t) return "—";
  return new Date(t).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const event = await getEvent(supabase, id);
  if (!event) {
    return (
      <main className="container-x py-10">
        <h1 className="text-3xl font-bold tracking-tight">Event not found</h1>
        <Link
          href="/events"
          className="press mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Browse events
        </Link>
      </main>
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  // Determine editor status: user is the community creator of the event's
  // community (events.community_id != null and communities.creator_id = uid).
  let isEditor = false;
  if (userId && event.community_id) {
    const { data: comm } = await supabase
      .from("communities")
      .select("creator_id")
      .eq("id", event.community_id)
      .maybeSingle();
    if (comm && (comm as { creator_id: string }).creator_id === userId) {
      isEditor = true;
    }
  }

  const [participantCount, participants, myRsvp] = await Promise.all([
    getEventParticipantCount(supabase, event.id),
    listEventParticipants(supabase, event.id),
    getMyRsvp(supabase, event.id, userId),
  ]);

  const effectiveCapacity = event.capacity ?? event.max_attendees;
  const isUnavailable =
    event.status === "CANCELLED" ||
    event.status === "COMPLETED" ||
    event.status === "EXPIRED" ||
    event.status === "DRAFT";
  const isFull = effectiveCapacity !== null && participantCount >= effectiveCapacity;

  return (
    <main className="container-x py-8 pb-20">
      <Link
        href="/events"
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to events
      </Link>
      <header className="mb-6 mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-fg">
            {event.title}
          </h1>
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
            {STATUS_LABEL[event.status] ?? event.status}
          </span>
          {event.is_pinned && (
            <span className="rounded-md border border-accent bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              Pinned
            </span>
          )}
        </div>
        {event.description && (
          <p className="whitespace-pre-wrap text-base text-text-secondary">
            {event.description}
          </p>
        )}
        {event.event_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.event_image_url}
            alt={`${event.title} image`}
            className="mt-2 w-full max-w-md rounded-xl border border-border object-cover"
          />
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {event.community_name && (
            <div>
              <dt className="text-xs text-text-muted uppercase tracking-wider">
                Community
              </dt>
              <dd className="text-fg">
                {event.community_slug ? (
                  <Link
                    href={`/communities/${event.community_slug}`}
                    className="hover:underline"
                  >
                    {event.community_name}
                  </Link>
                ) : (
                  event.community_name
                )}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Starts
            </dt>
            <dd className="text-fg">{formatWhen(event.start_time)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Ends
            </dt>
            <dd className="text-fg">{formatWhen(event.end_time)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Type
            </dt>
            <dd className="text-fg capitalize">{event.event_type}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted uppercase tracking-wider">
              Capacity
            </dt>
            <dd className="text-fg" data-testid="event-participant-count">
              {participantCount} / {effectiveCapacity ?? "∞"}
            </dd>
          </div>
        </dl>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!userId ? (
            <Link
              href={`/login?next=/events/${event.id}`}
              className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
            >
              Sign in to RSVP
            </Link>
          ) : isEditor ? (
            <span className="text-sm text-text-secondary">
              You are the event editor.
            </span>
          ) : (
            <EventRsvpButton
              eventId={event.id}
              initiallyRsvpd={!!myRsvp}
              disabled={isUnavailable}
              disabledReason={
                isFull
                  ? "Event is full"
                  : isUnavailable
                    ? `Event is ${event.status.toLowerCase()}`
                    : null
              }
            />
          )}
          {isEditor && !isUnavailable && (
            <EventHostControls eventId={event.id} status={event.status} />
          )}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg">
            Attendees ({participantCount})
          </h2>
        </header>
        {participants.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            No RSVPs yet. Be the first.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {participants.map((p) => (
              <li
                key={`${p.event_id}-${p.user_id}`}
                className="px-4 py-3 text-sm text-fg"
              >
                RSVP&apos;d{" "}
                <span className="text-text-muted">
                  {new Date(p.registered_at).toLocaleString(undefined, {
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
