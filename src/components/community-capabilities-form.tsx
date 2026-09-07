"use client";
// Community capability settings — Phase 2 V2
// Uses verified DEFAULT_COMMUNITY_CAPABILITIES from lib/community-capability
// No arbitrary assets — uses existing design tokens

import { useState } from "react";
import { DEFAULT_COMMUNITY_CAPABILITIES } from "@/lib/community-capability";

export function CommunityCapabilitiesForm({ initialEnabled = ["discussions", "media", "members"] }: { initialEnabled?: string[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_COMMUNITY_CAPABILITIES.map((c) => [c.id, initialEnabled.includes(c.id)]))
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-4 text-base font-bold text-fg">Community Capabilities</h3>
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
              onClick={() => setEnabled((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
              className={`h-6 w-11 rounded-full transition-colors duration-300 ${enabled[c.id] ? "bg-success" : "bg-surface-subtle border border-border"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${enabled[c.id] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
