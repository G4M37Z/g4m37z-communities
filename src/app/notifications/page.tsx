// src/app/notifications/page.tsx
// Notifications page — real implementation for Milestone 7.
// Protected route; shows user's notifications with mark-as-read actions.

import { redirect } from "next/navigation";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import type { Notification, Profile } from "@/types/database";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications — G4M37Z Communities",
  description: "Your notifications feed.",
};

type NotificationWithActor = Notification & {
  actor: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/notifications");
  }

  // Ensure profile exists (backfill for users who signed up before profile creation was added)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fallbackUsername =
      (typeof meta.username === "string" && meta.username.trim()) ||
      (user.email ? user.email.split("@")[0] : user.id);
    const safeUsername =
      String(fallbackUsername)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 30) || `user_${user.id.slice(0, 8)}`;

    await supabase.from("profiles").insert({
      id: user.id,
      username: safeUsername,
      display_name: String(fallbackUsername).slice(0, 80),
    });
  }

  // Fetch notifications with actor info
  const rawNotifications = await getMyNotifications(100);
  const unreadCount = await getUnreadNotificationCount();

  // Fetch actor profiles for all notifications
  const actorIds = Array.from(
    new Set(rawNotifications.map((n) => n.actor_id).filter(Boolean) as string[])
  );
  const actorProfiles = new Map<string, Pick<Profile, "id" | "username" | "display_name" | "avatar_url">>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds);
    for (const a of actors ?? []) {
      actorProfiles.set(a.id, a);
    }
  }

  const notifications: NotificationWithActor[] = rawNotifications.map((n) => ({
    ...n,
    actor: n.actor_id ? actorProfiles.get(n.actor_id) ?? null : null,
  }));

  return (
    <main className="container-x py-8 sm:py-10">
      <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Activity on your posts, comments, and communities.
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead} className="mt-4 sm:mt-0">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          </form>
        )}
      </header>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Bell size={36} className="mx-auto mb-4 text-text-muted" />
          <h2 className="mb-1 text-base font-bold text-fg">No notifications yet</h2>
          <p className="mx-auto max-w-md text-sm text-text-muted">
            When someone comments on your posts, replies to your comments, or upvotes
            your content, you'll see it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Notifications">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </ul>
      )}
    </main>
  );
}

interface NotificationItemProps {
  notification: NotificationWithActor;
}

function NotificationItem({ notification }: NotificationItemProps) {
  const { read, type, actor, created_at } = notification;

  const { label, href, icon: Icon } = getNotificationMeta(notification);

  return (
    <li
      className={`flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors ${
        !read ? "bg-accent/5 border-accent/20" : "hover:border-accent/40"
      }`}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">
          {actor && (
            <span className="font-semibold hover:text-accent">
              @{actor.username}
            </span>
          )}
          {label}
          {notification.reference_id && (
            <NotificationLink type={type} referenceId={notification.reference_id}>
              · View
            </NotificationLink>
          )}
        </p>

        <p className="mt-1 text-xs text-text-muted">{timeAgo(created_at)}</p>
      </div>

      {!read && (
        <form action={markNotificationRead} className="shrink-0">
          <input type="hidden" name="notificationId" value={notification.id} />
          <button
            type="submit"
            className="rounded-md p-1.5 text-text-muted hover:bg-bg hover:text-accent transition-colors"
            aria-label="Mark as read"
          >
            <Check size={16} />
          </button>
        </form>
      )}
    </li>
  );
}

function getNotificationMeta(notification: NotificationWithActor): {
  label: string;
  href: string | null;
  icon: React.ComponentType<{ size?: number }>;
} {
  const { type, reference_id } = notification;

  switch (type) {
    case "comment_on_post":
      return {
        label: " commented on your post",
        href: reference_id ? `/post/${reference_id}#comments` : null,
        icon: (props) => <MessageSquareIcon {...props} />,
      };
    case "reply_to_comment":
      return {
        label: " replied to your comment",
        href: reference_id ? `/post/${reference_id}#comments` : null,
        icon: (props) => <ReplyIcon {...props} />,
      };
    case "post_vote":
      return {
        label: " upvoted your post",
        href: reference_id ? `/post/${reference_id}` : null,
        icon: (props) => <ArrowUpIcon {...props} />,
      };
    case "comment_vote":
      return {
        label: " upvoted your comment",
        href: reference_id ? `/post/${reference_id}#comments` : null,
        icon: (props) => <ArrowUpIcon {...props} />,
      };
    case "report_resolved":
      return {
        label: " resolved your report",
        href: null,
        icon: (props) => <CheckCircleIcon {...props} />,
      };
    case "moderation_action":
      return {
        label: " took moderation action",
        href: null,
        icon: (props) => <ShieldIcon {...props} />,
      };
    case "mention":
      return {
        label: " mentioned you",
        href: null,
        icon: (props) => <AtSignIcon {...props} />,
      };
    case "community_invite":
      return {
        label: " invited you to a community",
        href: null,
        icon: (props) => <UsersIcon {...props} />,
      };
    default:
      return {
        label: "",
        href: null,
        icon: (props) => <BellIcon {...props} />,
      };
  }
}

function NotificationLink({
  type,
  referenceId,
  children,
}: {
  type: string;
  referenceId: string;
  children: React.ReactNode;
}) {
  const href = getHref(type, referenceId);
  if (!href) return <span className="text-text-muted">{children}</span>;

  return (
    <a
      href={href}
      className="ml-1 font-medium text-accent hover:underline"
    >
      {children}
    </a>
  );
}

function getHref(type: string, referenceId: string): string | null {
  switch (type) {
    case "comment_on_post":
    case "reply_to_comment":
    case "post_vote":
      return `/post/${referenceId}`;
    case "comment_vote":
      return `/post/${referenceId}#comments`;
    default:
      return null;
  }
}

// Inline icon components to avoid extra imports
function MessageSquareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function ReplyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3"></path>
      <path d="M7 10l-4 4 4 4"></path>
    </svg>
  );
}

function ArrowUpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  );
}

function CheckCircleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );
}

function AtSignIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
    </svg>
  );
}

function UsersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );
}