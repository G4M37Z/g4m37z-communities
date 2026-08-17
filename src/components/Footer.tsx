// src/components/Footer.tsx
// G4M37Z Communities site footer. Restrained, generous spacing.

import Link from "next/link";
import type { User } from "@supabase/supabase-js";

const EXPLORE = [
  { label: "Communities", href: "/communities" },
  { label: "Search", href: "/search" },
  { label: "Create", href: "/create" },
];

const ACCOUNT_SIGNED_OUT = [
  { label: "Sign in", href: "/login" },
  { label: "Sign up", href: "/signup" },
];

const ACCOUNT_SIGNED_IN = [
  { label: "Home", href: "/home" },
  { label: "Notifications", href: "/notifications" },
  { label: "Settings", href: "/settings" },
];

export function Footer({ user }: { user: User | null }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2">
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Explore
          </h3>
          <ul className="space-y-2 text-sm text-text-muted">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-fg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Account
          </h3>
          <ul className="space-y-2 text-sm text-text-muted">
            {(user ? ACCOUNT_SIGNED_IN : ACCOUNT_SIGNED_OUT).map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-fg"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-x flex flex-col items-start justify-between gap-2 py-5 text-xs text-text-muted sm:flex-row sm:items-center">
          <p>© {year} G4M37Z Communities.</p>
          <p>Built for gamers. Powered by Supabase &amp; Next.js.</p>
        </div>
      </div>
    </footer>
  );
}