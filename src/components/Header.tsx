// src/components/Header.tsx
// G4M37Z Communities site header. Server Component, renders the top
// nav, brand mark, and the auth-aware user menu.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";

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
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .maybeSingle();
      username = profile?.username ?? null;
      role = (profile?.role as string) ?? "member";
    }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="container-x flex h-14 items-center gap-4">
        <Link href="/" className="shrink-0">
          <Logo height={28} ariaLabel="G4M37Z Communities — home" />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && <NotificationBell />}
          {user ? (
            <UserMenu
              username={username}
              isAdmin={role === "admin"}
              isModerator={role === "moderator"}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-fg"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
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
