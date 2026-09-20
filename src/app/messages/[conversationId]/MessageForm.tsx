"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Smile, X } from "lucide-react";
import {
  sendMessage,
  uploadMessageAttachment,
  type MessageActionState,
} from "@/lib/messaging/actions";
import { STICKERS } from "@/lib/messaging/stickers";
import type { Message } from "@/lib/messaging/service";

export function MessageForm({
  conversationId,
  currentUserId,
  onSent,
}: {
  conversationId: string;
  currentUserId: string;
  onSent: (m: Message) => void;
}) {
  const [state, setState] = useState<MessageActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // Submit stays disabled until React is attached: a pre-hydration click must
  // not fall through to a native form GET (which aborts any in-flight server
  // action and loses the typed message).
  const [hydrated, setHydrated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Pending attachment (047): uploaded immediately on pick; sent with the
  // next message. Empty body + attachment is valid.
  const [attachment, setAttachment] = useState<
    { url: string; type: "image" | "gif" | "sticker" } | null
  >(null);
  const [uploading, setUploading] = useState(false);
  // Sticker picker (GAP-MSG-RICH-01): toggles the inline grid. Picking a
  // sticker sets the pending attachment directly (no upload — the asset is
  // first-party in /public/stickers).
  const [showStickers, setShowStickers] = useState(false);

  useEffect(() => {
    // Deferred per react-hooks/set-state-in-effect (house pattern, cf. ThemeToggle).
    queueMicrotask(() => setHydrated(true));
  }, []);

  function onPickSticker(url: string) {
    setAttachment({ url, type: "sticker" });
    setShowStickers(false);
    setState({ ok: true });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = ((fd.get("body") as string) ?? "").trim();
    if (!body && !attachment) return;
    startTransition(async () => {
      try {
        const result = await sendMessage(
          conversationId,
          body,
          attachment ?? undefined,
        );
        if (result.ok) {
          formRef.current?.reset();
          setAttachment(null);
          // Optimistic render: the row id comes from the server insert, so the
          // subsequent router.refresh() dedupes cleanly. Without this the UI
          // waited on the realtime echo (5–17s measured).
          if (result.message_id) {
            onSent({
              id: result.message_id,
              conversation_id: conversationId,
              sender_id: currentUserId,
              body,
              read: false,
              delivered: false,
              created_at: new Date().toISOString(),
              attachment_url: attachment?.url ?? null,
              attachment_type: attachment?.type ?? null,
            });
          }
          router.refresh();
        }
        setState(result);
      } catch {
        // Network/transport failure — keep the typed text so it can be retried.
        setState({ ok: false, error: "Your message didn't send. Please try again." });
      }
    });
  }

  async function onFile(file: File) {
    setUploading(true);
    setState({ ok: true });
    const res = await uploadMessageAttachment(file);
    setUploading(false);
    if (!res.ok) {
      setState({ ok: false, error: res.error });
      return;
    }
    setAttachment({ url: res.url, type: res.type });
  }

  return (
    <div>
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt=""
            className={`rounded-md object-cover ${attachment.type === "sticker" ? "h-12 w-12" : "h-14 w-14"}`}
          />
          <span className="text-xs text-text-muted">
            {attachment.type === "sticker"
              ? "Sticker ready"
              : attachment.type === "gif"
                ? "GIF ready"
                : "Image ready"}
          </span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label="Remove attachment"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:text-fg"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {showStickers && (
        <div className="mb-2 grid grid-cols-5 gap-1 rounded-lg border border-border bg-surface p-2">
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPickSticker(s.url)}
              aria-label={s.name}
              title={s.name}
              className="flex items-center justify-center rounded-md p-1 hover:bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.name} className="h-10 w-10" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (!hydrated || uploading) return;
            setShowStickers((v) => !v);
          }}
          aria-label="Add a sticker"
          aria-expanded={showStickers}
          title="Stickers"
          className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-text-muted hover:border-accent/60 hover:text-fg ${!hydrated ? "pointer-events-none" : ""}`}
        >
          <Smile size={16} />
        </button>
        <label
          htmlFor="message-attachment"
          aria-label="Attach an image or GIF"
          className={`inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-text-muted hover:border-accent/60 hover:text-fg ${uploading ? "opacity-60" : ""} ${!hydrated ? "pointer-events-none" : ""}`}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          <input
            id="message-attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <input
          name="body"
          placeholder="Type a message…"
          maxLength={4000}
          required={!attachment}
          disabled={isPending || !hydrated}
          className="flex-1 h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || uploading || !hydrated}
          className="press h-10 shrink-0 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "…" : "Send"}
        </button>
        {!state.ok && (
          <p className="absolute bottom-full mb-1 text-xs text-red-500">{state.error}</p>
        )}
      </form>
    </div>
  );
}
