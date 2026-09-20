"use client";
// PlatformLinksForm — manual, self-reported gaming-platform handles
// (042_platform_links.sql). Persists via savePlatformLinksAction.
//
// These are DECLARED identities, not verified connections. The copy says so
// and the UI never renders a verified badge.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Check } from "lucide-react";
import { savePlatformLinksAction } from "@/lib/profiles/actions";
import { PlatformIcon } from "@/components/platform-icon";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
  type PlatformLink,
} from "@/lib/profiles/platforms";

interface Props {
  initial?: PlatformLink[] | null;
}

type Draft = Record<Platform, { handle: string; profile_url: string }>;

function emptyDraft(): Draft {
  return PLATFORMS.reduce((acc, p) => {
    acc[p] = { handle: "", profile_url: "" };
    return acc;
  }, {} as Draft);
}

function draftFrom(links: PlatformLink[] | null | undefined): Draft {
  const draft = emptyDraft();
  for (const link of links ?? []) {
    if (link.platform in draft) {
      draft[link.platform] = {
        handle: link.handle,
        profile_url: link.profile_url ?? "",
      };
    }
  }
  return draft;
}

export function PlatformLinksForm({ initial = null }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(platform: Platform, field: "handle" | "profile_url", value: string) {
    setDraft((prev) => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const payload = PLATFORMS.map((platform) => ({
      platform,
      handle: draft[platform].handle.trim(),
      profile_url: draft[platform].profile_url.trim() || null,
    })).filter((row) => row.handle.length > 0);

    startTransition(async () => {
      const res = await savePlatformLinksAction(payload);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <Link2 size={16} className="text-accent-text" />
        <h3 className="text-base font-bold text-fg">Linked platforms</h3>
        {saved && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-text-muted">
        Self-reported — these are the handles you use, shown on your profile so
        others can find you. Leave a field blank to remove a link.
      </p>

      <div className="flex flex-col gap-3">
        {PLATFORMS.map((platform) => (
          <fieldset key={platform} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-muted">
                <PlatformIcon platform={platform} className="h-3.5 w-3.5" labelHidden />
                {PLATFORM_LABELS[platform]}
              </span>
              <input
                type="text"
                value={draft[platform].handle}
                onChange={(e) => set(platform, "handle", e.target.value)}
                maxLength={64}
                placeholder="Handle / ID"
                aria-label={`${PLATFORM_LABELS[platform]} handle`}
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-text-muted">
                Profile URL (optional)
              </span>
              <input
                type="url"
                value={draft[platform].profile_url}
                onChange={(e) => set(platform, "profile_url", e.target.value)}
                maxLength={300}
                placeholder="https://…"
                aria-label={`${PLATFORM_LABELS[platform]} profile URL`}
                className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </label>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-9 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save platform links"}
        </button>
        {error && <p role="alert" className="text-xs text-sale">{error}</p>}
      </div>
    </form>
  );
}
