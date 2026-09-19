"use client";

// src/app/messages/[conversationId]/ThreadClient.tsx
// Client-side message list + composer. The sender's own message renders
// OPTIMISTICALLY the instant the server action resolves — the thread used to
// wait for the Supabase realtime echo (measured 5–17s on real connections)
// before showing the just-sent message, which read as "error… then it sends".
// router.refresh() from onSent/ThreadLive reconciles with server truth; the
// realtime channel still covers incoming messages.

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/messaging/service";
import { MessageForm } from "./MessageForm";

export type ProfileMap = Map<
  string,
  { username: string; display_name: string | null; avatar_url: string | null }
>;

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

  // Keep the newest message visible as the thread grows.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
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
    <>
      {messages.length === 0 && (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-6 py-10 text-center">
          <span aria-hidden className="text-2xl">💬</span>
          <p className="text-sm font-medium text-fg">No messages yet</p>
          <p className="text-xs text-text-muted">
            Say hello — your message will appear here instantly.
          </p>
        </div>
      )}

      <ul
        ref={listRef}
        className="space-y-1.5 mb-4 max-h-[60vh] overflow-y-auto"
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

          return (
            <li key={m.id}>
              {showDivider && (
                <div className="my-3 flex items-center gap-3" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {label}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
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
                  className={`max-w-[75%] px-3 py-2 text-sm ${
                    own
                      ? "bg-accent text-white"
                      : "border border-border bg-surface text-fg"
                  } ${
                    own
                      ? grouped
                        ? "rounded-lg rounded-tr-sm"
                        : "rounded-lg"
                      : grouped
                        ? "rounded-lg rounded-tl-sm"
                        : "rounded-lg"
                  }`}
                >
                  {m.sender_id !== currentUserId && !grouped && (
                    <p className="mb-0.5 text-[10px] font-semibold text-text-muted">
                      {p?.display_name ?? p?.username ?? "Unknown"}
                    </p>
                  )}
                  {m.attachment_url && (
                    // Attachment bubble (047). Renders above any caption text;
                    // the public-read bucket URL is safe to embed directly.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.attachment_url}
                      alt={m.attachment_type === "gif" ? "GIF" : "Shared image"}
                      className={`mb-1 block max-h-64 w-full rounded-md object-cover ${own ? "rounded-md" : ""}`}
                      loading="lazy"
                    />
                  )}
                  {(m.body || !m.attachment_url) && (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  {m.created_at && (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
                      <time dateTime={m.created_at}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </time>
                      {m.sender_id === currentUserId &&
                        (() => {
                          // Blue ✓✓ = partner's last_read_at is at/after the
                          // message; grey ✓ = sent, grey ✓✓ = delivered.
                          const isRead =
                            partnerReadAt != null &&
                            m.created_at != null &&
                            partnerReadAt >= m.created_at;
                          const isDelivered = m.read === true;
                          return (
                            <span
                              title={isRead ? "Read" : isDelivered ? "Delivered" : "Sent"}
                              className={
                                isRead ? "text-sky-400" : undefined
                              }
                            >
                              {isRead || isDelivered ? "✓✓" : "✓"}
                            </span>
                          );
                        })()}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <MessageForm
        conversationId={conversationId}
        currentUserId={currentUserId}
        onSent={handleSent}
      />
    </>
  );
}
