"use client";

// src/app/messages/[conversationId]/ThreadLive.tsx
// Marks the thread read on open (033 policy: last_read_at only) and streams
// new messages live via the supabase_realtime publication (033 adds messages).
// Reloads the server-rendered list on each incoming row so authorization and
// ordering stay server-authoritative.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markReadAction } from "@/lib/messaging/actions";

export function ThreadLive({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    // Mark read once per mount; failures are non-fatal (state stays stale).
    markReadAction(conversationId).then(() => router.refresh());

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  return null;
}
