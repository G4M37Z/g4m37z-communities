"use client";
// Bottom navigation — mobile-first (<768px). Persistent, touch-friendly.
// Shows Home / Communities / Create / Notifications / Profile.

import Link from "next/link";
import { Home, Users, Plus, Bell, User } from "lucide-react";

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Communities", href: "/communities", icon: Users },
  { label: "Create", href: "/create", icon: Plus },
  { label: "Alerts", href: "/notifications", icon: Bell },
];

export function BottomNav({ username }: { username?: string }) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/90 md:hidden"
    >
      <div className="flex h-16 items-center justify-around">
        {NAV.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="press flex min-h-[44px] w-16 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium text-text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
        {username ? (
          <Link
            href={`/profile/${username}`}
            className="press flex min-h-[44px] w-16 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium text-text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <User size={20} strokeWidth={1.8} />
            <span>Me</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="press flex min-h-[44px] w-16 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium text-text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <User size={20} strokeWidth={1.8} />
            <span>Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
