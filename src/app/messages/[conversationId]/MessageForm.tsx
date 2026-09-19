"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, type MessageActionState } from "@/lib/messaging/actions";
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

  useEffect(() => {
    // Deferred per react-hooks/set-state-in-effect (house pattern, cf. ThemeToggle).
    queueMicrotask(() => setHydrated(true));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = (fd.get("body") as string) ?? "";
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        const result = await sendMessage(conversationId, body);
        if (result.ok) {
          formRef.current?.reset();
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

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
      <input
        name="body"
        placeholder="Type a message…"
        maxLength={4000}
        required
        disabled={isPending || !hydrated}
        className="flex-1 h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending || !hydrated}
        className="press h-10 shrink-0 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "…" : "Send"}
      </button>
      {!state.ok && (
        <p className="absolute bottom-full mb-1 text-xs text-red-500">{state.error}</p>
      )}
    </form>
  );
}
