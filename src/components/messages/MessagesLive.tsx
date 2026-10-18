"use client";

// src/components/messages/MessagesLive.tsx
// Invisible reconciler for /messages. While the list sits open, server-rendered
// badges must track reality: a message arriving should raise them, reading a
// thread elsewhere should drain them. Strategy (same economics as
// NotificationBell): 30s poll of the cheap get_unread_counts() RPC plus a
// realtime INSERT listener on `messages` (RLS delivers only rows I can read,
// i.e. my conversations) for instant pushes. router.refresh() re-renders the
// server component with current counts; only fired on an actual change so the
// page is not perpetually re-rendered.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MessagesLive() {
  const router = useRouter();
  // Signature of the last observed counts; refresh only on change.
  const sigRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function check() {
      const { data } = await supabase.rpc("get_unread_counts");
      if (cancelled) return;
      const sig = JSON.stringify(data ?? []);
      if (sigRef.current !== null && sig !== sigRef.current) {
        router.refresh();
      }
      sigRef.current = sig;
    }

    void check();
    const timer = setInterval(check, 30_000);

    const channel = supabase
      .channel("messages-list-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, check)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
