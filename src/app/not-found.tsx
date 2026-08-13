// src/app/not-found.tsx
// Catch-all 404 page rendered by Next.js for any unmatched route,
// including nested notFound() calls from page.tsx files.

import Link from "next/link";
import { Home, Search, Mail } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg px-4">
      <div className="container-x max-w-2xl text-center">
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-accent">
          Error 404
        </p>
        <h1 className="mb-4 text-4xl font-black text-fg sm:text-6xl">
          We couldn&apos;t find that page
        </h1>
        <p className="mb-8 text-base text-text-muted sm:text-lg">
          The link may be broken, or the page may have been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Home size={16} />
            Back to home
          </Link>
          <Link
            href="/category/electronics"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-fg"
          >
            <Search size={16} />
            Browse products
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-6 py-3 text-sm font-semibold text-fg transition-colors hover:border-fg"
          >
            <Mail size={16} />
            Contact us
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 text-left">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-fg">
            Popular categories
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              { label: "Electronics", href: "/category/electronics" },
              { label: "Home & Garden", href: "/category/home-garden" },
              { label: "Fashion", href: "/category/fashion-accessories" },
              { label: "Beauty", href: "/category/beauty-personal-care" },
              { label: "Sports", href: "/category/sports-outdoors" },
              { label: "Gadgets", href: "/category/gadgets" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-text-muted transition-colors hover:text-accent"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
