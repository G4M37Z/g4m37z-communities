"use client";
// Bottom navigation — mobile-first (<768px). Persistent, touch-friendly.
// Shows Home / Communities / Create / Messages / Me. Notifications stay
// reachable via the header bell.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Plus, MessageCircle, User } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { cn } from "@/lib/utils";
import { UnreadMessagesBadge } from "@/components/messages/UnreadMessagesBadge";

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Communities", href: "/communities", icon: Users },
  { label: "Create", href: "/create", icon: Plus },
  { label: "Messages", href: "/messages", icon: MessageCircle },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ username }: { username?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="material material-bright-top bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Safe-area padding on the nav (no fixed height) keeps the 64px row intact
          and taps clear of the iOS home indicator (viewportFit: cover). */}
      <div className="flex h-16 items-center justify-around">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-[44px] w-16 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium transition-colors",
                active
                  ? "nav-item-active-top text-accent-text"
                  : "text-text-muted hover:bg-surface hover:text-fg",
              )}
            >
              {href === "/home" ? (
                <BrandMark size={20} />
              ) : (
                <span className="relative inline-flex">
                  <Icon size={20} strokeWidth={1.8} />
                  {href === "/messages" && <UnreadMessagesBadge />}
                </span>
              )}
              <span>{label}</span>
            </Link>
          );
        })}
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
