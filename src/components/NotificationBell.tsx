// src/components/NotificationBell.tsx
// Notification bell with unread count. Client component for real-time updates.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let userId: string | null = null;

    // Initial fetch
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      await fetchUnreadCount();

      // Subscribe to realtime notifications
      if (userId) {
        const channel = supabase
          .channel("notifications")
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            () => {
              fetchUnreadCount();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    }

    const cleanup = init();
    return () => {
      if (cleanup) cleanup.then((fn) => fn?.());
    };
  }, [supabase]);

  async function fetchUnreadCount() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setUnreadCount(count ?? 0);
  }

  if (typeof window === "undefined") return null; // SSR safety

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center p-2 text-text-muted hover:text-fg transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
    >
      {unreadCount > 0 ? (
        <BellRing size={22} className="text-accent" />
      ) : (
        <Bell size={22} />
      )}
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}