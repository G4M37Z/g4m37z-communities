"use client";
// PresenceHeartbeat — keeps the current user's presence row fresh.
// Mounted once at the root layout for signed-in users.
// - "online" with activity_context = current path on mount + every 60s
// - "away" when the tab is hidden
// - "offline" on pagehide/unload

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { updatePresence } from "@/lib/presence/actions";

const HEARTBEAT_MS = 60_000;

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const lastContextRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const send = (status: "online" | "away") => {
      const context = pathname;
      void updatePresence(status, context);
    };

    const tick = () => {
      if (cancelled) return;
      send("online");
    };

    // Initial heartbeat + periodic refresh.
    send("online");
    const interval = window.setInterval(tick, HEARTBEAT_MS);

    const onVisibility = () => {
      // Debounce: only re-send when the context changes to avoid a rewrite pile-up.
      if (pathname === lastContextRef.current) return;
      if (document.visibilityState === "visible") {
        lastContextRef.current = pathname;
        send("online");
      } else {
        lastContextRef.current = pathname;
        send("away");
      }
    };
    const onPageHide = () => {
      void updatePresence("offline");
    };
    const onBeforeUnload = () => {
      void updatePresence("offline");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [pathname]);

  return null;
}