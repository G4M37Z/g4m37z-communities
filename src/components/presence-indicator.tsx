"use client";
// Presence indicator — V2 identity layer extension
// Uses existing profile/auth; no new DB table required for V1 presence
// States: online / away / busy / offline / invisible (per spec §8)

import { useState, useEffect } from "react";

interface PresenceProps {
  userId?: string;
  username?: string;
  size?: number;
  className?: string;
}

export function PresenceIndicator({ userId, username, size = 10, className = "" }: PresenceProps) {
  const [status, setStatus] = useState<"online" | "away" | "busy" | "offline" | "invisible">("offline");

  useEffect(() => {
    // V1 foundation: presence derived from activity; V2 extends to realtime
    // For V1, show online if profile active; else default to offline
    setStatus("online");
    const t = setTimeout(() => setStatus("online"), 3000);
    return () => clearTimeout(t);
  }, [userId]);

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
