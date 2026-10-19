// ============================================================================
// src/instrumentation-client.ts
// Runs before the app becomes interactive. Captures UNCAUGHT window errors
// and unhandled rejections (errors React boundaries never see) and beacons
// them to /api/client-error so they land in Vercel function logs. One-shot:
// the first crash is the one we want.
// ============================================================================

let sent = false;

function beacon(payload: Record<string, string>): void {
  if (sent) return;
  sent = true;
  try {
    void fetch("/api/client-error", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // diagnostics must never throw
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    beacon({
      via: "window.error",
      m: err?.message || String(event.message || ""),
      s: err?.stack || `${event.filename ?? ""}:${event.lineno ?? ""}`,
      p: location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    beacon({
      via: "unhandledrejection",
      m: reason?.message || String(event.reason),
      s: reason?.stack || "",
      p: location.href,
    });
  });
}
