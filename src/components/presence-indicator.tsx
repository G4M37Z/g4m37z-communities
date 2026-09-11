"use client";
// Presence indicator — lives from the user_presence table (025) via realtime.
// States map: online -> online, away -> away, in_voice -> busy, offline/unk -> offline

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PresenceStatus = "online" | "away" | "busy" | "offline" | "invisible";

interface PresenceProps {
  userId: string;
  username?: string;
  size?: number;
  className?: string;
}

function mapStatus(db: string | null | undefined): PresenceStatus {
  switch (db) {
    case "online":
      return "online";
    case "away":
      return "away";
    case "in_voice":
      return "busy";
    default:
      return "offline";
  }
}

export function PresenceIndicator({ userId, username, size = 10, className = "" }: PresenceProps) {
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase
      .from("user_presence")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setDbStatus((data as { status: string }).status);
      });

    const channel = supabase
      .channel(`presence:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!active) return;
          const row = payload.new as { status?: string } | null;
          setDbStatus(row?.status ?? null);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const status = useMemo(() => mapStatus(dbStatus), [dbStatus]);

  const color = {
    online: "bg-success",
    away: "bg-warning",
    busy: "bg-sale",
    offline: "bg-text-muted",
    invisible: "bg-transparent border border-text-muted",
  }[status];

  return (
    <span
      className={`inline-block rounded-full border-2 border-bg ${color} ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Presence: ${status}`}
      title={`${username ?? "User"} — ${status}`}
    />
  );
}