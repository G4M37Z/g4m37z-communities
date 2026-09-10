import { SupabaseClient, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

// Supabase RealtimePostgresChangesPayload requires T to be a row-like record.
// We default to a permissive row shape so callers can pass typed tables.
export type RealtimeRow = Record<string, unknown>;

export interface RealtimeSubscriptionOptions<T extends RealtimeRow = RealtimeRow> {
  schema: string;
  table: string;
  event: RealtimeEvent;
  filter?: string;
  callback: (payload: RealtimePayload<T>) => void;
}
export interface RealtimePayload<T extends RealtimeRow = RealtimeRow> {
  eventType: RealtimeEvent;
  new?: T;
  old?: T;
}

export function subscribe<T extends RealtimeRow = RealtimeRow>(
  supabase: SupabaseClient,
  opts: RealtimeSubscriptionOptions<T>,
) {
  const { schema, table, event, filter, callback } = opts;
  const channelName = `${schema}:${table}:${event}:${filter ?? "all"}`;
  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event, schema, table, ...(filter ? { filter } : {}) },
      (payload: RealtimePostgresChangesPayload<T>) => {
        callback({
          eventType: payload.eventType as RealtimeEvent,
          // Supabase types `new`/`old` as `{} | T` / `Partial<T>`; we widen
          // through unknown because RealtimePostgresChangesPayload already
          // constrains T to a row shape compatible with our wrapper.
          new: payload.new as T | undefined,
          old: payload.old as T | undefined,
        });
      },
    )
    .subscribe();
  return { channel, unsubscribe: () => supabase.removeChannel(channel) };
}

export function useRealtime<T extends RealtimeRow = RealtimeRow>(
  supabase: SupabaseClient,
  opts: RealtimeSubscriptionOptions<T>,
) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const { unsubscribe } = subscribe(supabase, opts);
    return () => {
      void unsubscribe();
    };
    // opts is intentionally omitted from deps: callers pass object literals;
    // subscribing to primitives prevents thrash while remaining reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, opts.schema, opts.table, opts.event, opts.filter]);
}
