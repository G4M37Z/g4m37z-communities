"use client";

// src/components/messages/UnreadMessagesBadge.tsx
// Live unread-DM count for nav chrome (Sidebar rail / desktop sidebar /
// BottomNav). Sums the get_unread_counts() RPC (migration 055 grants EXECUTE
// to authenticated; RLS scopes rows to the caller's memberships).
//
// Reconciles three ways, so the badge drops the moment messages are read and
// rises the moment they arrive:
//   1. 30s poll (cheap indexed RPC, resilient to missed realtime events);
//   2. realtime INSERT on `messages` — any row I can read triggers a refresh;
//   3. realtime UPDATE/DELETE on `conversation_members` — my last_read_at
//      write (markConversationRead) and membership changes.
// No badge renders at zero; <99 shows the number, else "99+".

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Topics must be unique per mounted instance: supabase.channel(name) REUSES
// an existing channel with the same topic, and .on('postgres_changes', …)
// throws once that channel is joining/joined — which crashed the whole page
// when Sidebar and BottomNav mounted this badge together.
let topicSeq = 0;

export function UnreadMessagesBadge() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function refresh() {
      const { data } = await supabase.rpc("get_unread_counts");
      if (cancelled) return;
      const sum = ((data ?? []) as { unread_count: number }[]).reduce(
        (acc, r) => acc + Number(r.unread_count ?? 0),
        0,
      );
      setTotal(sum);
    }

    void refresh();

    const channel = supabase
      .channel(`unread-dm-badge:${++topicSeq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        refresh,
      )
      .subscribe();

    const timer = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  if (total <= 0) return null;
  return (
    <span
      className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white shadow"
      aria-label={`${total} unread messages`}
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}
