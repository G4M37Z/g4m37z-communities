"use client";

// src/app/error.tsx
// Root error boundary. Catches uncaught errors in any descendant route
// segment and shows a recovery UI instead of a white screen.

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const doRetry = retry ?? reset ?? (() => {});

  useEffect(() => {
    // Surface to the browser console so devs see it locally; in prod
    // ship to your error tracker (Sentry, etc.) here.
    console.error("App error boundary caught:", error);
    try {
      void fetch("/api/client-error", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          via: "error.tsx",
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

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4">
      <div className="container-x max-w-xl text-center">
        <BrandMark size={36} className="mx-auto mb-5 block text-fg" />
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-surface">
          <AlertTriangle size={28} className="text-accent-text" />
        </div>
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-accent-text">
          Something went wrong
        </p>
        <h1 className="mb-4 text-3xl font-black text-fg sm:text-4xl">
          We hit an unexpected error
        </h1>
        <p className="mb-8 text-base text-text-muted">
          The page failed to load. This is on us — please try again, or head
          back to the homepage.
        </p>

        {error.digest && (
          <p className="mb-6 font-mono text-xs text-text-muted">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={doRetry}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <RotateCw size={16} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-fg"
          >
            <Home size={16} />
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
