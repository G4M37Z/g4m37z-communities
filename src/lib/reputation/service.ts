import { createClient } from "@/lib/supabase/server";

export interface ReputationEvent {
  user_id: string;
  source_type: string;
  source_id: string;
  event_type: string;
  weight?: number;
}

export async function recordReputationEvent(evt: ReputationEvent) {
  const supabase = await createClient();
  const { error } = await supabase.from("reputation_events").insert({
    user_id: evt.user_id,
    source_type: evt.source_type,
    source_id: evt.source_id,
    event_type: evt.event_type,
    weight: evt.weight ?? 1,
    timestamp: new Date().toISOString(),
  });
  if (error) console.error("Reputation event failed:", error.message);
  return { error };
}
