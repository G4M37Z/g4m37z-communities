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

  return (
    <>
      {messages.length === 0 && (
        <p className="mb-4 text-center text-sm text-text-muted">
          No messages yet — say hello.
        </p>
      )}

      <ul
        ref={listRef}
        className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto"
      >
        {messages.map((m) => (
          <li
            key={m.id}
            className={`flex items-end gap-2 ${m.sender_id === currentUserId ? "justify-end" : ""}`}
          >
            {m.sender_id !== currentUserId &&
              (() => {
                const p = profiles.get(m.sender_id ?? "");
                return p?.avatar_url ? (
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
                );
              })()}
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.sender_id === currentUserId
                  ? "bg-accent text-white"
                  : "border border-border bg-surface text-fg"
              }`}
            >
              {m.sender_id !== currentUserId && (
                <p className="mb-0.5 text-[10px] font-semibold text-text-muted">
                  {(() => {
                    const p = profiles.get(m.sender_id ?? "");
                    return p?.display_name ?? p?.username ?? "Unknown";
                  })()}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {m.created_at && (
                <div className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
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
          </li>
        ))}
      </ul>

      <MessageForm
        conversationId={conversationId}
        currentUserId={currentUserId}
        onSent={handleSent}
      />
    </>
  );
}
