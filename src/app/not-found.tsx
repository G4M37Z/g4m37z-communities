// src/app/not-found.tsx
// Catch-all 404 page rendered by Next.js for any unmatched route,
// including nested notFound() calls from page.tsx files.

import Link from "next/link";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4">
      <div className="container-x max-w-xl text-center">
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-accent">
          Error 404
        </p>
        <h1 className="mb-4 text-4xl font-black text-fg sm:text-5xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mb-8 text-base text-text-muted sm:text-lg">
          The link may be broken, or the page may have been moved.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Home size={16} />
            Back to home
          </Link>
          <Link
            href="/communities"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
          >
            <Compass size={16} />
            Browse communities
          </Link>
        </div>
      </div>
    </main>
  );
}
