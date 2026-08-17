// src/components/UserMenu.tsx
// Avatar + dropdown for signed-in users. Shows display name and links
// to the user's profile, settings, notifications, and a sign-out action.

import Link from "next/link";
import { User as UserIcon, ChevronDown, Shield } from "lucide-react";
import { SignOutButton } from "./SignOutButton";

interface UserMenuProps {
  username: string | null;
  isModerator?: boolean;
  isAdmin?: boolean;
}

export function UserMenu({ username, isModerator, isAdmin }: UserMenuProps) {
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
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white">
          {initial}
        </span>
        <ChevronDown size={14} className="hidden sm:inline" />
      </button>

      <div
        role="menu"
        className="invisible absolute right-0 top-full z-50 mt-1 w-56 origin-top-right rounded-lg border border-border bg-bg opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <ul className="py-1 text-sm">
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
