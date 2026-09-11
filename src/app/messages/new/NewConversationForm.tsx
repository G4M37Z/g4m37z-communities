"use client";

import { useRef, useState, useTransition } from "react";
import { createConversation, type MessageActionState } from "@/lib/messaging/actions";

export function NewConversationForm() {
  const [state, setState] = useState<MessageActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createConversation({ ok: true }, fd);
      setState(result);
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="recipient" className="block text-sm font-medium text-fg">
          Recipient username
        </label>
        <input
          id="recipient"
          name="recipient"
          required
          minLength={2}
          maxLength={32}
          disabled={isPending}
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-fg">
          First message
        </label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={4000}
          rows={3}
          disabled={isPending}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>
      {!state.ok && (
        <p className="text-xs text-red">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Starting…" : "Start conversation"}
      </button>
    </form>
  );
}
