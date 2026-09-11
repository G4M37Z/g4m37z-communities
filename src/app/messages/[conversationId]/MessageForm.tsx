"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage, type MessageActionState } from "@/lib/messaging/actions";

export function MessageForm({ conversationId }: { conversationId: string }) {
  const [state, setState] = useState<MessageActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = (fd.get("body") as string) ?? "";
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await sendMessage(conversationId, body);
      if (result.ok) {
        formRef.current?.reset();
      }
      setState(result);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
      <input
        name="body"
        placeholder="Type a message…"
        maxLength={4000}
        required
        disabled={isPending}
        className="flex-1 h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="press h-10 shrink-0 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "…" : "Send"}
      </button>
      {!state.ok && (
        <p className="absolute bottom-full mb-1 text-xs text-red">{state.error}</p>
      )}
    </form>
  );
}
