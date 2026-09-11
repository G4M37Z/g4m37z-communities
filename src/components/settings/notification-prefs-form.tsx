"use client";
// NotificationPreferencesForm — opt-out toggles for notification channels.
// Persisted to profiles.notification_prefs JSONB via updateNotificationPrefs.

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { updateNotificationPrefs } from "@/lib/profiles/actions";

const CHANNELS = [
  { key: "comments", label: "Comments on my posts", desc: "When someone comments on a post you created" },
  { key: "replies", label: "Replies to my comments", desc: "When someone replies to your comment" },
  { key: "votes", label: "Upvotes", desc: "When someone upvotes your post or comment" },
  { key: "follows", label: "New followers", desc: "When someone follows you" },
  { key: "events", label: "Event RSVPs (community creator)", desc: "When someone RSVPs to your event" },
  { key: "mentions", label: "Mentions", desc: "When someone @mentions you in a post or comment" },
] as const;

interface Props {
  initial?: Record<string, boolean>;
}

export function NotificationPreferencesForm({ initial = {} }: Props) {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(CHANNELS.map((c) => [c.key, initial[c.key] ?? true])),
  );
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(key: string) {
    if (pending) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(false);
    startTransition(async () => {
      const res = await updateNotificationPrefs(next);
      setSaved(res.ok);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell size={16} className="text-accent" />
        <h3 className="text-base font-bold text-fg">Notification preferences</h3>
        {saved && <span className="ml-auto text-xs text-success">Saved</span>}
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Choose which notification channels are active. Disabled channels are never generated.
      </p>
      <div className="divide-y divide-border">
        {CHANNELS.map((ch) => (
          <div key={ch.key} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-fg">{ch.label}</div>
              <div className="text-xs text-text-muted">{ch.desc}</div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(ch.key)}
              aria-pressed={prefs[ch.key]}
              aria-label={`Toggle ${ch.label}`}
              className={`h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                prefs[ch.key]
                  ? "bg-success"
                  : "bg-surface-subtle border border-border"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  prefs[ch.key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}