"use client";

// src/components/communities/CommunityMediaForm.tsx
// Icon + banner upload for community settings. Upload is awaited, the result
// replaces the preview, errors surface inline.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { uploadCommunityMedia } from "@/lib/communities/actions";

interface Props {
  communityId: string;
  iconUrl: string | null;
  bannerUrl: string | null;
}

type Kind = "icon" | "banner";

export function CommunityMediaForm({ communityId, iconUrl, bannerUrl }: Props) {
  const [icon, setIcon] = useState(iconUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const [error, setError] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);
  const [, startTransition] = useTransition();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  function pick(kind: Kind) {
    (kind === "icon" ? iconInputRef : bannerInputRef).current?.click();
  }

  function upload(kind: Kind, input: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) return;
    setError(null);
    setPendingKind(kind);
    const fd = new FormData();
    fd.set("communityId", communityId);
    fd.set("kind", kind);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadCommunityMedia(fd);
      setPendingKind(null);
      if (res.ok) {
        if (res.kind === "icon") setIcon(res.url);
        else setBanner(res.url);
        input!.value = "";
      } else {
        setError(res.error);
      }
    });
  }

  const fields: { kind: Kind; label: string; url: string | null; ref: React.RefObject<HTMLInputElement | null>; accept: string }[] = [
    { kind: "icon", label: "Icon", url: icon, ref: iconInputRef, accept: "image/jpeg,image/png,image/webp,image/gif" },
    { kind: "banner", label: "Banner", url: banner, ref: bannerInputRef, accept: "image/jpeg,image/png,image/webp,image/gif" },
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-base font-bold text-fg">Community media</h3>
      <p className="mt-1 text-xs text-text-muted">
        JPEG, PNG, WebP, or GIF · max 5 MB. Shown on the community page and cards.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map(({ kind, label, url, ref, accept }) => (
          <div key={kind}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {label}
            </p>
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-md border border-border bg-bg">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={`${label} preview`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-text-muted">No image yet</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => pick(kind)}
              disabled={pendingKind !== null}
              className="press mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface-subtle disabled:opacity-50"
            >
              {pendingKind === kind ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {pendingKind === kind ? "Uploading…" : url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
            </button>
            <input
              ref={ref}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => upload(kind, e.currentTarget)}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}
    </section>
  );
}
