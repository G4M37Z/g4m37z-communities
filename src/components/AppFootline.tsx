"use client";
// src/components/AppFootline.tsx
// Compact site footline for app surfaces — gives every page the same
// professional bottom edge (single row, border-t) without re-adding the
// big Explore/Account link columns. Hidden on routes that render the full
// Footer (landing, auth, legal).

import Link from "next/link";
import { usePathname } from "next/navigation";

const FULL_FOOTER_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
]);

export function AppFootline() {
  const pathname = usePathname();
  if (FULL_FOOTER_ROUTES.has(pathname)) return null;

  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div
        className="container-x flex flex-col items-start justify-between gap-2 py-5 pb-[max(1.25rem,calc(3.5rem+env(safe-area-inset-bottom)))] text-xs text-text-muted md:flex-row md:items-center md:pb-5"
      >
        <p>© G4M37Z</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="transition-colors hover:text-fg">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-fg">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
