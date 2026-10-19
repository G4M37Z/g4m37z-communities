// src/components/NotificationBell.tsx
// Notification bell with unread count. Client component for real-time updates.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Unique topic per mounted instance: supabase.channel(name) REUSES an
// existing channel with the same topic and .on('postgres_changes', …)
// throws once it is joining/joined. Header and Sidebar both mount this
// bell, so a shared "notifications" topic made the second instance throw
// (swallowed by the catch below — its bell silently stopped updating).
let topicSeq = 0;

export function NotificationBell({
  label,
  className,
}: {
  label?: string;
  className?: string;
} = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [supabase] = useState(() => createClient());

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

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Teardown race: if the effect was cleaned up while the auth call was
      // pending, don't subscribe now (the unique topic below already keeps
      // parallel mounts from colliding on a joining channel).
      if (cancelled) return;
      const userId = user?.id ?? null;

      await fetchUnreadCount();
      if (cancelled || !userId) return;

      // "*" so the badge reconciles on INSERT (new activity) AND UPDATE
      // (marked read elsewhere: /notifications page, another tab).
      const channel = supabase
        .channel(`notifications:${++topicSeq}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void fetchUnreadCount();
          }
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    }

    init().catch((e: unknown) =>
      console.error("NotificationBell init failed:", e)
    );

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <Link
      href="/notifications"
      className={cn(
        "inline-flex items-center justify-center gap-3 p-2 text-text-muted hover:text-fg transition-colors",
        className,
      )}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
    >
      <span className="relative inline-flex">
        {unreadCount > 0 ? (
          <BellRing size={22} className="text-accent-text" />
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
      </span>
      {label && <span className="hidden text-sm font-medium lg:inline">{label}</span>}
    </Link>
  );
}