// src/components/Header.tsx
// G4M37Z Communities site header. Server Component. Scroll-aware: quiets
// (slightly raises surface opacity + border) once the page scrolls.

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { HeaderScrollObserver } from "@/components/HeaderScrollObserver";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { label: "Home", href: "/home" },
  { label: "Communities", href: "/communities" },
  { label: "Games", href: "/discover" },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Saved", href: "/saved" },
  { label: "Create", href: "/create" },
];

export async function Header() {
  const { user, username, role, avatarUrl } = await getCurrentUser();

  return (
    <header className="material material-bright-top site-header sticky top-0 z-40 border-b border-transparent">
      <HeaderScrollObserver />
      <div className="container-x flex h-14 items-center gap-4">
        <Link href="/" className="shrink-0" aria-label="G4M37Z Communities — home">
          <Logo height={26} ariaLabel="G4M37Z Communities — home" />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-0.5 sm:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="press rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Theme toggle hides on the smallest screens: the lockup + bell +
              avatar overflow under ~380px. It stays reachable there through
              the UserMenu's mobile theme row below. */}
          <span className="hidden xs:inline-block sm:inline-block">
            <ThemeToggle />
          </span>
          {user && <NotificationBell />}
          {user ? (
            <UserMenu
              userId={user.id}
              username={username}
              avatarUrl={avatarUrl}
              isAdmin={role === "admin"}
              isModerator={role === "moderator"}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="press rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="press inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}