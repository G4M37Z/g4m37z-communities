// src/lib/realtime/service.ts
// Realtime subscription helper for the G4M37Z platform.
// Provides a consistent API for creating, managing, and cleaning up Supabase Realtime channels.

import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

/**
 * Options for a realtime subscription.
 */
export interface RealtimeSubscriptionOptions {
  /** The schema name, usually "public". */
  schema: string;
  /** The table name to listen to. */
  table: string;
  /** The event type to listen for. */
  event: RealtimeEvent;
  /** Optional filter expression, e.g. "user_id=eq.<uuid>" */
  filter?: string;
  /** Callback invoked when a matching event fires. */
  callback: (payload: RealtimePayload) => void;
}

/**
 * Generic payload shape for a Supabase Realtime event.
 * For INSERT/UPDATE, the new row is under `new`.
 * For DELETE, the old row is under `old`.
 */
export interface RealtimePayload<T = unknown> {
  eventType: RealtimeEvent;
  new?: T;
  old?: T;
}

/**
 * Subscribe to a Supabase Realtime channel.
 * Returns an object with the channel and an `unsubscribe` function.
 */
export function subscribe(
  supabase: SupabaseClient,
  opts: RealtimeSubscriptionOptions,
) {
  const { schema, table, event, filter, callback } = opts;

  const channelName = `${schema}:${table}:${event}:${filter ?? "all"}`;
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event,
        schema,
        table,
        ...(filter ? { filter } : {}),
      },
      (payload) => {
        // Normalise payload for the consumer.
        const normalized: RealtimePayload = {
          eventType: payload.eventType as RealtimeEvent,
          new: (payload as Record<string, unknown>).new as unknown,
          old: (payload as Record<string, unknown>).old as unknown,
        };
        callback(normalized);
      },
    )
    .subscribe();

  // Return cleanup function.
  const unsubscribe = () => {
    supabase.removeChannel(channel);
  };

  return { channel, unsubscribe };
}

/**
 * Batch-subscribe to multiple tables/events.
 * Returns a single cleanup function that unsubscribes all channels.
 */
export function batchSubscribe(
  supabase: SupabaseClient,
  subscriptions: RealtimeSubscriptionOptions[],
) {
  const subscriptionsList = subscriptions.map((opts) => subscribe(supabase, opts));
  return () => {
    subscriptionsList.forEach((sub) => sub.unsubscribe());
  };
}

/**
 * React hook for subscribing to realtime events inside client components.
 * Automatically cleans up on unmount.
 */
export function useRealtime(
  supabase: SupabaseClient,
  opts: RealtimeSubscriptionOptions,
) {
  const isFirstRender = require("react").useRef(true);
  require("react").useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const { unsubscribe } = subscribe(supabase, opts);
    return () => {
      unsubscribe();
    };
  }, [
    supabase,
    opts.schema,
    opts.table,
    opts.event,
    opts.filter,
  ]); // Note: callback should be stable (use useCallback) to avoid re-subscribing.
}

/**
 * Helper to publish a payload to a table (client-side trigger).
 */
export async function publishRealtime<T = unknown>(
  supabase: SupabaseClient,
  schema: string,
  table: string,
  payload: T,
) {
  try {
    await supabase.from(table).insert(payload as Record<string, unknown>);
  } catch (e) {
    console.error("Realtime publish failed", e);
  }
}
-- Realtime subscription handler (already created)
Using subscribe/update patterns
