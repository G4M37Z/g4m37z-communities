"use client";
// Presence indicator — V2 identity layer extension
// Uses existing profile/auth; no new DB table required for V1 presence
// States: online / away / busy / offline / invisible (per spec §8)

import { useMemo } from "react";

type PresenceStatus = "online" | "away" | "busy" | "offline" | "invisible";

interface PresenceProps {
  userId?: string;
  username?: string;
  size?: number;
  className?: string;
}

// V2 extension hook: for now, presence is derived deterministically from the
// supplied userId (presence values are not yet persisted; V3 will replace this
// with realtime subscription). Returning a memoized value avoids setState in
// useEffect and the cascading-render warning.
function resolveStatus(_userId: string | undefined): PresenceStatus {
  return _userId ? "online" : "offline";
}

export function PresenceIndicator({ userId, username, size = 10, className = "" }: PresenceProps) {
  const status = useMemo(() => resolveStatus(userId), [userId]);

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
