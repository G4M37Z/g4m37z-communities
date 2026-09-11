"use client";
// Community capability settings — Phase 2 V2 / V4.
// Toggles are persisted via the saveCapabilities server action (026).
// Uses verified DEFAULT_COMMUNITY_CAPABILITIES from lib/community-capability
// and existing design tokens.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_COMMUNITY_CAPABILITIES } from "@/lib/community-capability";
import { saveCapabilities } from "@/lib/communities/actions";

export function CommunityCapabilitiesForm({
  communityId,
  initialEnabled = ["discussions", "media", "members"],
}: {
  communityId: string;
  initialEnabled?: string[];
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        DEFAULT_COMMUNITY_CAPABILITIES.map((c) => [
          c.id,
          initialEnabled.includes(c.id),
        ]),
      ),
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [saved, setSaved] = useState(true);

  function toggle(id: string) {
    if (pending) return;
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      setSaved(false);
      startTransition(async () => {
        const res = await saveCapabilities(
          communityId,
          Object.keys(next).filter((k) => next[k]),
        );
        if (res.ok) {
          setSaved(true);
          router.refresh();
        } else {
          // Revert to the previously visible state on failure.
          setEnabled((current) => ({ ...current, [id]: !current[id] }));
        }
      });
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-fg">Community Capabilities</h3>
        {saved ? (
          <span className="text-xs text-text-muted">All changes saved</span>
        ) : (
          <span className="animate-pulse text-xs text-accent">Saving…</span>
        )}
      </div>
      <div className="divide-y divide-border">
        {DEFAULT_COMMUNITY_CAPABILITIES.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-semibold text-fg">{c.label}</div>
              <div className="text-xs text-text-muted">{c.description}</div>
            </div>
            <button
              type="button"
              aria-pressed={enabled[c.id]}
              aria-label={`${enabled[c.id] ? "Disable" : "Enable"} ${c.label}`}
              disabled={pending}
              onClick={() => toggle(c.id)}
              className={`h-6 w-11 rounded-full transition-colors duration-300 ${
                enabled[c.id]
                  ? "bg-success"
                  : "bg-surface-subtle border border-border"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  enabled[c.id] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}