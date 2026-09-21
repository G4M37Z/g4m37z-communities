// src/components/UserMenu.tsx
// Avatar + dropdown for signed-in users. Shows display name and links
// to the user's profile, V3 surface destinations (Games, Tournaments),
// notifications, settings, and a sign-out action.

import Link from "next/link";
import {
  User as UserIcon,
  ChevronDown,
  Shield,
  Gamepad2,
  Trophy,
  MessageCircle,
} from "lucide-react";
import { PresenceIndicator } from "@/components/presence-indicator";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

/** Theme row shown only below the xs breakpoint (see header density note). */
function MobileThemeRow() {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <span className="text-fg">Theme</span>
      <ThemeToggle />
    </div>
  );
}

interface UserMenuProps {
  userId: string;
  username: string | null;
  avatarUrl?: string | null;
  isModerator?: boolean;
  isAdmin?: boolean;
}

export function UserMenu({ userId, username, avatarUrl, isModerator, isAdmin }: UserMenuProps) {
  // Fall back to "?" when no username is set yet.
  const initial = (username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg hover:bg-surface"
      >
        <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
          <PresenceIndicator
            userId={userId}
            username={username ?? undefined}
            size={10}
            className="absolute -bottom-0.5 -right-0.5"
          />
        </span>
        <ChevronDown size={14} className="hidden sm:inline" />
      </button>

      <div
        role="menu"
        className="menu-enter absolute right-0 top-full z-50 mt-1 w-56 origin-top-right rounded-lg border border-border bg-bg shadow-lg"
      >
        <ul className="py-1 text-sm">
          {/* Mobile theme toggle row: the header hides its toggle below the
              xs breakpoint (lockup + bell + avatar crowd); this row keeps the
              control reachable on the smallest screens. */}
          <li className="xs:hidden">
            <MobileThemeRow />
          </li>
          {username && (
            <li>
              <Link
                href={`/profile/${username}`}
                className="flex items-center gap-2 px-4 py-2 text-fg hover:bg-surface"
              >
                <UserIcon size={14} />
                My profile
              </Link>
            </li>
          )}
          <li>
            <Link
              href="/discover"
              className="flex items-center gap-2 px-4 py-2 text-fg hover:bg-surface"
            >
              <Gamepad2 size={14} />
              Games
            </Link>
          </li>
          <li>
            <Link
              href="/tournaments"
              className="flex items-center gap-2 px-4 py-2 text-fg hover:bg-surface"
            >
              <Trophy size={14} />
              Tournaments
            </Link>
          </li>
          <li>
            <Link
              href="/messages"
              className="flex items-center gap-2 px-4 py-2 text-fg hover:bg-surface"
            >
              <MessageCircle size={14} />
              Messages
            </Link>
          </li>
          <li>
            <Link
              href="/notifications"
              className="block px-4 py-2 text-fg hover:bg-surface"
            >
              Notifications
            </Link>
          </li>
          <li>
            <Link
              href="/settings"
              className="block px-4 py-2 text-fg hover:bg-surface"
            >
              Settings
            </Link>
          </li>
          {(isAdmin || isModerator) && (
            <li>
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 text-fg hover:bg-surface"
              >
                <Shield size={14} />
                Admin
              </Link>
            </li>
          )}
        </ul>
        <div className="border-t border-border p-1">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
