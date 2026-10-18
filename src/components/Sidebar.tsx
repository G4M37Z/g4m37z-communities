"use client";
// src/components/Sidebar.tsx
// Persistent left navigation — the md+ chrome.
//   • md (tablet): slim icon rail (w-16), icons only.
//   • lg (desktop): full sidebar (w-60) with labels + brand wordmark.
// Mobile (<md) uses the Header + BottomNav instead (this hides below md).
// Client component so it can mark the active route.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Compass,
  Trophy,
  MessageCircle,
  Bookmark,
  Plus,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Communities", href: "/communities", icon: Users },
  { label: "Games", href: "/discover", icon: Compass },
  { label: "Tournaments", href: "/tournaments", icon: Trophy },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Saved", href: "/saved", icon: Bookmark },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  username: string | null;
  avatarUrl: string | null;
  role: string;
}

export function Sidebar({ username, avatarUrl, role }: SidebarProps) {
  const pathname = usePathname();
  const isSignedIn = Boolean(username);
  const initial = (username ?? "?").charAt(0).toUpperCase();
  const isStaff = role === "admin" || role === "moderator";

  return (
    <aside
      aria-label="Primary"
      className="material fixed inset-y-0 left-0 z-50 hidden w-16 flex-col border-r border-border md:flex lg:w-60"
    >
      {/* Brand — mark on the rail, full wordmark on desktop */}
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-border px-2 lg:justify-start lg:px-4">
        <Link
          href="/"
          aria-label="G4M37Z Communities — home"
          className="press flex items-center gap-2.5"
        >
          <BrandMark size={26} />
          <span className="hidden lg:inline-block">
            <BrandWordmark height={20} />
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 lg:px-3">
        <ul className="space-y-1">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start",
                    active
                      ? "nav-item-active bg-accent-soft text-accent-text"
                      : "text-text-secondary hover:bg-bg hover:text-fg",
                  )}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              </li>
            );
          })}
          {isStaff && (
            <li>
              <Link
                href="/admin"
                title="Admin"
                aria-current={isActive(pathname, "/admin") ? "page" : undefined}
                className={cn(
                  "press flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:justify-start",
                  isActive(pathname, "/admin")
                    ? "nav-item-active bg-accent-soft text-accent-text"
                    : "text-text-secondary hover:bg-bg hover:text-fg",
                )}
              >
                <Shield size={20} strokeWidth={2} />
                <span className="hidden lg:inline">Admin</span>
              </Link>
            </li>
          )}
        </ul>

        <div className="mt-3 border-t border-border pt-3">
          <Link
            href="/create"
            title="Create"
            className="press flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover lg:justify-start"
          >
            <Plus size={18} strokeWidth={2.4} />
            <span className="hidden lg:inline">Create</span>
          </Link>
        </div>
      </nav>

      {/* Bottom: notifications, theme, account */}
      <div className="shrink-0 border-t border-border p-2 lg:p-3">
        <div className="flex flex-col items-center gap-1.5 lg:items-stretch">
          {isSignedIn && (
            <NotificationBell
              label="Notifications"
              className="w-full justify-center rounded-lg px-3 py-2 hover:bg-bg lg:justify-start"
            />
          )}
          <div className="flex items-center justify-center gap-3 px-1 py-1 lg:justify-start">
            <ThemeToggle />
            <span className="hidden text-sm font-medium text-text-secondary lg:inline">
              Theme
            </span>
          </div>

          <div className="mt-1 flex items-center justify-center gap-2.5 border-t border-border px-1 pt-2 lg:justify-start">
            {isSignedIn ? (
              <Link
                href={`/profile/${username}`}
                title="Your profile"
                className="press flex items-center gap-2.5 rounded-lg p-1.5 text-sm font-medium text-fg transition-colors hover:bg-bg"
              >
                <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{initial}</span>
                  )}
                </span>
                <span className="hidden truncate lg:inline">
                  {username ? `@${username}` : "My profile"}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="press flex items-center gap-2.5 rounded-lg p-1.5 text-sm font-medium text-fg transition-colors hover:bg-bg"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border">
                  <UserIcon size={16} />
                </span>
                <span className="hidden lg:inline">Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
