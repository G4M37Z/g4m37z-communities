"use client";

// src/app/messages/[conversationId]/ThreadClient.tsx
// Client-side message list + composer. The sender's own message renders
// OPTIMISTICALLY the instant the server action resolves — the thread used to
// wait for the Supabase realtime echo (measured 5–17s on real connections)
// before showing the just-sent message, which read as "error… then it sends".
// router.refresh() from onSent/ThreadLive reconciles with server truth; the
// realtime channel still covers incoming messages.
//
// Chat-surface behaviour (GAP-MSG-UI-01 v2): the list is a flex-height
// scroller pinned under the thread header, auto-scrolls to the newest message
// only when the reader is already near the bottom (a "Jump to latest" pill
// appears otherwise), and bubbles use chat-style shaping with in-bubble
// timestamps and receipts.

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/messaging/service";
import { MessageForm } from "./MessageForm";

export type ProfileMap = Map<
  string,
  { username: string; display_name: string | null; avatar_url: string | null }
>;

/** Distance (px) from the bottom within which auto-scroll stays engaged. */
const NEAR_BOTTOM_PX = 120;

export function ThreadClient({
  conversationId,
  currentUserId,
  initialMessages,
  profiles,
  readState,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  profiles: ProfileMap;
  readState: Map<string, string | null>;
}) {
  // Receipts (046): a direct thread has exactly one partner; their
  // last_read_at is the instant the sender's ✓✓ turns blue. Falls back to
  // the legacy per-row `read` flag when the RPC returns no partner row
  // (non-direct or RPC error), preserving the old behaviour.
  const partnerReadAt = [...readState.entries()].find(
    ([id]) => id !== currentUserId
  )?.[1];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // Render-phase reconciliation with server truth (the documented
  // "adjust state when a prop changes" pattern — no effect needed).
  // Optimistic rows share the server id (the action returns the inserted
  // message_id), so an id-dedup merge keeps everything in sync.
  const serverSig = initialMessages.map((m) => m.id).join(",");
  const [seenSig, setSeenSig] = useState(serverSig);
  if (serverSig !== seenSig) {
    setSeenSig(serverSig);
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of initialMessages) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );
    });
  }
  const listRef = useRef<HTMLUListElement>(null);
  // Track whether the reader is pinned to the bottom. While pinned, new
  // messages auto-scroll; while reading history, they don't yank the view —
  // a jump pill offers the way back down.
  const pinnedRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  function measurePinned() {
    const el = listRef.current;
    if (!el) return true;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    pinnedRef.current = nearBottom;
    return nearBottom;
  }

  // Keep the newest message visible — but only while the reader is already
  // at (or near) the bottom. Reading history must not be interrupted.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTo({ top: el.scrollHeight });
    } else {
      setShowJump(true);
    }
  }, [messages.length]);

  function handleSent(m: Message) {
    setMessages((prev) =>
      prev.some((x) => x.id === m.id) ? prev : [...prev, m]
    );
  }

  // Day divider label: Today / Yesterday / locale date. Pure helper — safe
  // to compute per row; the list is bounded at MAX_PAGE (50).
  function dayLabel(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfToday.getTime() - day.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {messages.length === 0 && (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <span aria-hidden className="text-3xl">💬</span>
          <p className="text-sm font-semibold text-fg">No messages yet</p>
          <p className="max-w-xs text-xs text-text-muted">
            Break the ice — send a message, a sticker, or start a call. Your
            message appears here instantly.
          </p>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <ul
          ref={listRef}
          onScroll={() => {
            const near = measurePinned();
            if (near) setShowJump(false);
          }}
          className="flex flex-col space-y-1 overflow-y-auto px-1 pb-2"
          style={{ maxHeight: "min(58vh, 34rem)", minHeight: "12rem", scrollBehavior: "smooth" }}
        >
          {messages.map((m, i) => {
            const own = m.sender_id === currentUserId;
            const prev = i > 0 ? messages[i - 1] : undefined;

            // Day divider: render when the calendar day changes.
            const label = dayLabel(m.created_at);
            const prevLabel = prev ? dayLabel(prev.created_at) : null;
            const showDivider = label !== null && label !== prevLabel;

            // Group consecutive bubbles from the same sender within 5 minutes:
            // avatar/name only on the first of a run, tighter spacing inside.
            const sameSender = prev?.sender_id === m.sender_id;
            const gapMins =
              prev && prev.created_at && m.created_at
                ? (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) / 60000
                : Infinity;
            const grouped = sameSender && gapMins < 5 && !showDivider;
            const p = profiles.get(m.sender_id ?? "");
            // Sticker messages (GAP-MSG-RICH-01) render as a plain centred
            // asset — no bubble chrome on an already-accent-coloured bubble.
            const isSticker = m.attachment_type === "sticker";
            // Call-log rows (GAP-MSG-CALL-01) are written server-side by the
            // call RPCs; they render as a centred system pill, not a bubble.
            const isCallLog = m.attachment_type === "call";

            const divider = showDivider ? (
              <div className="my-3 flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {label}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null;

            if (isCallLog) {
              return (
                <li key={m.id}>
                  {divider}
                  <div className="my-3 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-text-muted">
                      <span aria-hidden>📞</span>
                      {m.body}
                    </span>
                  </div>
                </li>
              );
            }

            const time = m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : null;
            // Blue ✓✓ = partner's last_read_at is at/after the message;
            // grey ✓ = sent, grey ✓✓ = delivered.
            const isRead =
              partnerReadAt != null &&
              m.created_at != null &&
              partnerReadAt >= m.created_at;
            const isDelivered = m.read === true;

            return (
              <li key={m.id}>
                {divider}
                <div
                  className={`flex items-end gap-2 ${own ? "justify-end" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}
                >
                  {m.sender_id !== currentUserId &&
                    (grouped ? (
                      // spacer keeps grouped bubbles aligned with the run's avatar
                      <span className="w-7 shrink-0" aria-hidden />
                    ) : p?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url}
                        alt={p.display_name ?? p.username}
                        className="h-7 w-7 shrink-0 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="h-7 w-7 shrink-0 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-fg">
                        {((p?.display_name ?? p?.username ?? "U"))
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    ))}
                  <div
                    className={`max-w-[78%] text-sm shadow-sm ${
                      isSticker
                        ? "bg-transparent px-0 py-0 shadow-none"
                        : own
                          ? "rounded-2xl bg-accent px-3.5 py-2 text-white"
                          : "rounded-2xl border border-border bg-surface px-3.5 py-2 text-fg"
                    } ${
                      isSticker
                        ? ""
                        : own
                          ? grouped
                            ? "rounded-br-md"
                            : "rounded-br-sm"
                          : grouped
                            ? "rounded-bl-md"
                            : "rounded-bl-sm"
                    }`}
                  >
                    {m.sender_id !== currentUserId && !grouped && !isSticker && (
                      <p className="mb-0.5 text-[10px] font-semibold text-text-muted">
                        {p?.display_name ?? p?.username ?? "Unknown"}
                      </p>
                    )}
                    {m.attachment_url && (
                      // Attachment bubble (047). Renders above any caption text;
                      // the public-read bucket URL is safe to embed directly.
                      // Stickers are first-party /public/stickers assets and get
                      // the compact centred treatment.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.attachment_url}
                        alt={
                          isSticker
                            ? "Sticker"
                            : m.attachment_type === "gif"
                              ? "GIF"
                              : "Shared image"
                        }
                        className={
                          isSticker
                            ? "block h-28 w-28 object-contain"
                            : `mb-1 block max-h-64 w-full rounded-xl object-cover`
                        }
                        loading="lazy"
                      />
                    )}
                    {!isSticker && (m.body || !m.attachment_url) && (
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    )}
                    {time && (
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own && !isSticker ? "text-white/70" : "text-text-muted"}`}
                      >
                        <time dateTime={m.created_at ?? undefined}>{time}</time>
                        {m.sender_id === currentUserId && (
                          <span
                            title={isRead ? "Read" : isDelivered ? "Delivered" : "Sent"}
                            className={isRead ? "text-sky-300" : own && !isSticker ? "text-white/70" : undefined}
                          >
                            {isRead || isDelivered ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {showJump && (
          <button
            type="button"
            onClick={() => {
              const el = listRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight });
              pinnedRef.current = true;
              setShowJump(false);
            }}
            className="press absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg shadow-lg hover:bg-bg"
          >
            ↓ Jump to latest
          </button>
        )}
      </div>

      <MessageForm
        conversationId={conversationId}
        currentUserId={currentUserId}
        onSent={(m) => {
          // Our own send always pins the view back to the newest message.
          pinnedRef.current = true;
          setShowJump(false);
          requestAnimationFrame(() => {
            const el = listRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight });
          });
          handleSent(m);
        }}
      />
    </div>
  );
}
