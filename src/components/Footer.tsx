// src/components/Footer.tsx
// G4M37Z Communities site footer.

import Link from "next/link";

const EXPLORE = [
  { label: "Communities", href: "/communities" },
  { label: "Search", href: "/search" },
  { label: "Create", href: "/create" },
];

const ACCOUNT = [
  { label: "Sign in", href: "/login" },
  { label: "Sign up", href: "/signup" },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2">
        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-fg">
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
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-fg">
            Account
          </h3>
          <ul className="space-y-2 text-sm text-text-muted">
            {ACCOUNT.map((l) => (
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
        <div className="container-x flex flex-col items-start justify-between gap-3 py-5 text-xs text-text-muted sm:flex-row sm:items-center">
          <p>© {year} G4M37Z Communities.</p>
          <p className="text-text-muted">
            Built for gamers. Powered by Supabase & Next.js.
          </p>
        </div>
      </div>
    </footer>
  );
}
