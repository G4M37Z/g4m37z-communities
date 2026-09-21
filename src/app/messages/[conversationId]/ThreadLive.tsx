"use client";

// src/app/messages/[conversationId]/ThreadLive.tsx
// Marks the thread read on open (033 policy: last_read_at only) and streams
// new messages live via the supabase_realtime publication (033 adds messages).
// Reloads the server-rendered list on each incoming row so authorization and
// ordering stay server-authoritative.
//
// Live-session hardening: long-lived tabs silently lose postgres_changes
// delivery after network switches, sleep/wake, or socket drops — the UI looks
// connected but new messages stop arriving (observed in the field). Three
// safety nets keep the thread honest without giving up realtime latency:
//   1. a subscribe-status callback that re-subscribes on CHANNEL_ERROR /
//      TIMED_OUT / CLOSED (fresh channel name, so a stuck slot can't persist),
//   2. a refresh when the tab becomes visible again,
//   3. a slow 30s refresh while the tab is visible as the final fallback.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { markReadAction } from "@/lib/messaging/actions";

const FALLBACK_REFRESH_MS = 30_000;

export function ThreadLive({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  useEffect(() => {
    // Mark read once per mount; failures are non-fatal (state stays stale).
    // Swallow rejections so a transport error can't surface as an unhandled
    // promise rejection.
    markReadAction(conversationId)
      .then(() => router.refresh())
      .catch(() => {});

    const supabase = createClient();
    let closed = false;

    const connect = (name: string, attempt: number) => {
      if (closed) return;
      const channel = supabase
        .channel(name)
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
        .subscribe((status) => {
          if (closed) return;
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            // Drop the possibly-stuck channel and rejoin under a fresh name.
            void supabase.removeChannel(channel).finally(() => {
              if (closed) return;
              // Cap the retry storm: after a few attempts the 30s fallback
              // refresh still keeps the thread correct.
              if (attempt < 5) {
                connect(
                  `messages:${conversationId}:${Date.now()}`,
                  attempt + 1,
                );
              }
              router.refresh();
            });
          }
        });
      return channel;
    };

    const first = connect(`messages:${conversationId}`, 0);

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, FALLBACK_REFRESH_MS);

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(fallback);
      if (first) void supabase.removeChannel(first);
    };
  }, [conversationId, router]);

  return null;
}
