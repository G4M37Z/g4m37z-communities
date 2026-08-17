// src/components/Header.tsx
// G4M37Z Communities site header. Server Component. Scroll-aware: quiets
// (slightly raises surface opacity + border) once the page scrolls.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { HeaderScrollObserver } from "@/components/HeaderScrollObserver";

const NAV = [
  { label: "Home", href: "/home" },
  { label: "Communities", href: "/communities" },
  { label: "Create", href: "/create" },
];

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let role: string = "member";
  let avatarUrl: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    username = profile?.username ?? null;
    role = (profile?.role as string) ?? "member";
    avatarUrl = (profile?.avatar_url as string | null) ?? null;
  }

  return (
    <header className="site-header sticky top-0 z-40 border-b border-transparent bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
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
          {user && <NotificationBell />}
          {user ? (
            <UserMenu
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