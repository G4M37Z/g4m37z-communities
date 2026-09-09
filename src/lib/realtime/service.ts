import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";
export interface RealtimeSubscriptionOptions { schema: string; table: string; event: RealtimeEvent; filter?: string; callback: (payload: any) => void; }
export interface RealtimePayload<T = unknown> { eventType: RealtimeEvent; new?: T; old?: T; }

export function subscribe(supabase: SupabaseClient, opts: RealtimeSubscriptionOptions) {
  const { schema, table, event, filter, callback } = opts;
  const channelName = `${schema}:${table}:${event}:${filter ?? "all"}`;
  const channel = supabase.channel(channelName).on("postgres_changes", { event, schema, table, ...(filter ? { filter } : {}) }, (payload) => {
    callback({ eventType: payload.eventType as RealtimeEvent, new: (payload as any).new, old: (payload as any).old });
  }).subscribe();
  return { channel, unsubscribe: () => supabase.removeChannel(channel) };
}

export function useRealtime(supabase: SupabaseClient, opts: RealtimeSubscriptionOptions) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const { unsubscribe } = subscribe(supabase, opts);
    return () => unsubscribe();
  }, [supabase, opts.schema, opts.table, opts.event, opts.filter]);
}
