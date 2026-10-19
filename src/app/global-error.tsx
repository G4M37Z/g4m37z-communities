"use client";

// src/app/global-error.tsx
// Custom root-layout error boundary (replaces Next's builtin "This page
// couldn't load" screen). Renders the actual error message/stack on-page so
// the failure is visible without DevTools, and beacons it to
// /api/client-error (Vercel function logs). Must render its own <html>/<body>.

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}

const button: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 999,
  border: "none",
  background: "#0070D1",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export default function GlobalError({ error, retry, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error);
    try {
      void fetch("/api/client-error", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          via: "global-error",
          m: error.message,
          d: error.digest ?? "",
          s: error.stack ?? "",
          p: location.href,
        }),
      });
    } catch {
      // diagnostics must never throw
    }
  }, [error]);

  const recover = retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#0B0C0E",
          color: "#F4F4F5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 680, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>
            This page couldn&rsquo;t load
          </h1>
          <p style={{ margin: "0 0 18px", color: "#A1A1AA", fontSize: 14 }}>
            A client-side error crashed the app. The details below have been
            sent to the developers.
          </p>
          <pre
            style={{
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#18181B",
              border: "1px solid #27272A",
              borderRadius: 8,
              padding: 14,
              fontSize: 12,
              lineHeight: 1.5,
              maxHeight: 220,
              overflow: "auto",
              margin: "0 0 18px",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="button" style={button} onClick={() => location.reload()}>
              Reload
            </button>
            <button
              type="button"
              style={{ ...button, background: "transparent", border: "1px solid #3F3F46" }}
              onClick={() =>
                history.length > 1 ? history.back() : location.reload()
              }
            >
              Back
            </button>
            {recover && (
              <button
                type="button"
                style={{ ...button, background: "transparent", border: "1px solid #3F3F46" }}
                onClick={() => recover()}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
