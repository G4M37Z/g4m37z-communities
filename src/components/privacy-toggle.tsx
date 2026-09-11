"use client";
// Privacy toggle — sets communities.is_private. Members-only visibility.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Globe } from "lucide-react";
import { togglePrivacy } from "@/lib/communities/actions";

export function PrivacyToggle({
  communityId,
  isPrivate,
}: {
  communityId: string;
  isPrivate: boolean;
}) {
  const [value, setValue] = useState(isPrivate);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    if (pending) return;
    const previous = value;
    const next = !previous;
    setValue(next);
    startTransition(async () => {
      const res = await togglePrivacy(communityId);
      if (res.ok) {
        setValue(res.is_private);
        router.refresh();
      } else {
        setValue(previous);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-fg">Community privacy</h3>
          <p className="mt-1 text-xs text-text-muted">
            {value
              ? "Private — only members can see this community and its posts."
              : "Public — anyone can view this community and its posts."}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          aria-pressed={value}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-4 text-xs font-semibold transition-colors ${
            value
              ? "border border-border bg-bg text-fg hover:bg-surface"
              : "bg-accent text-white hover:bg-accent-hover"
          } disabled:opacity-40`}
        >
          {value ? <Lock size={14} /> : <Globe size={14} />}
          {value ? "Private" : "Public"}
        </button>
      </div>
    </div>
  );
}