import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listEvents, EVENT_STATUSES, type EventStatus } from "@/lib/events/service";
import { PageEnter } from "@/components/PageEnter";

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

export default async function EventsDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; community?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Restrict display to genuinely discoverable states. DRAFT / COMPLETED /
  // EXPIRED / CANCELLED are filtered out by default; user opts in via
  // ?status=all.
  const defaultStatuses: EventStatus[] = ["PUBLISHED"];
  const requested = sp.status === "all"
    ? EVENT_STATUSES.filter((s) => s !== "DRAFT")
    : defaultStatuses;

  const events = await listEvents(supabase, {
    search: sp.q,
    status: requested,
    limit: 30,
  });

  // Bounded: fetch participant counts only for the displayed subset.
  // Cannot do head:true per event efficiently without a separate query
  // per row; for V3.5 we approximate participant count as 0 here and let
  // the detail page show the precise count.
  const items: Array<typeof events[number]> = events;

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20">
        <header className="mb-8 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-fg">
              Events
            </h1>
            <span className="text-sm text-text-muted">
              {items.length} {items.length === 1 ? "event" : "events"}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Community events and tournaments. RSVP to lock in your spot.
          </p>
          <div className="mt-2">
            {userData?.user ? (
              <Link
                href="/events/new"
                className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Create event
              </Link>
            ) : (
              <Link
                href="/login?next=/events"
                className="press inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-fg hover:border-border-strong"
              >
                Sign in to create
              </Link>
            )}
          </div>
        </header>

        <form
          className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
          action="/events"
          method="get"
        >
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search title / description / type…"
            maxLength={64}
            aria-label="Search events"
            className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <select
            name="status"
            defaultValue={sp.status ?? "open"}
            aria-label="Filter by status"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="open">Open (Published)</option>
            <option value="all">All (including closed)</option>
          </select>
          <button
            type="submit"
            className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Filter
          </button>
        </form>

        {items.length === 0 ? (
          <section className="rounded-lg border border-border bg-surface p-10 text-center">
            <h2 className="text-base font-semibold text-fg">
              No matching events
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Try a different search term or status filter.
            </p>
          </section>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/events/${e.id}`}
                    className="text-base font-semibold text-fg hover:underline"
                  >
                    {e.title}
                  </Link>
                  <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-text-secondary">
                  {e.community_name && (
                    <div>
                      <dt className="text-text-muted">Community</dt>
                      <dd className="text-fg">{e.community_name}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-text-muted">When</dt>
                    <dd className="text-fg">{formatWhen(e.start_time)}</dd>
                  </div>
                  {typeof e.capacity === "number" && (
                    <div>
                      <dt className="text-text-muted">Capacity</dt>
                      <dd className="text-fg">{e.capacity}</dd>
                    </div>
                  )}
                  {e.event_type && (
                    <div>
                      <dt className="text-text-muted">Type</dt>
                      <dd className="text-fg">{e.event_type}</dd>
                    </div>
                  )}
                </dl>
                {e.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
                    {e.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </PageEnter>
  );
}
