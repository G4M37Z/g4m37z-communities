"use client";

// src/app/messages/new/NewConversationForm.tsx
// Recipient picker: people the user follows / already messages are listed
// first (graph-first), with a live case-insensitive search fallback for anyone
// else. Picking a suggestion fills the canonical username so the server lookup
// resolves exactly. No one has to remember a handle.

import { useEffect, useRef, useState, useTransition } from "react";
import {
  createConversation,
  searchRecipients,
  type MessageActionState,
} from "@/lib/messaging/actions";
import type { RecipientSuggestion } from "@/lib/messaging/service";

function Avatar({ person }: { person: RecipientSuggestion }) {
  if (person.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar_url}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft/40 text-xs font-semibold text-accent-text">
      {(person.display_name ?? person.username).charAt(0).toUpperCase()}
    </span>
  );
}

export function NewConversationForm({
  suggestions,
}: {
  suggestions: RecipientSuggestion[];
}) {
  const [state, setState] = useState<MessageActionState>({ ok: true });
  const [isPending, startTransition] = useTransition();
  const [recipient, setRecipient] = useState("");
  const [results, setResults] = useState<RecipientSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  // Submit stays disabled until React is attached: a pre-hydration click must
  // not fall through to a native form GET (which leaks the message body into
  // the URL and aborts any in-flight server action).
  const [hydrated, setHydrated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Deferred per react-hooks/set-state-in-effect (house pattern, cf. ThemeToggle).
    queueMicrotask(() => setHydrated(true));
  }, []);

  const q = recipient.trim().replace(/^@+/, "").toLowerCase();

  useEffect(() => {
    if (q.length === 0) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const found = await searchRecipients(q);
        if (active) {
          setResults(found);
          setSearching(false);
        }
      } catch {
        if (active) {
          setResults([]);
          setSearching(false);
        }
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("recipient") ?? "").trim()) {
      setState({ ok: false, error: "Choose someone to message." });
      return;
    }
    startTransition(async () => {
      try {
        const result = await createConversation({ ok: true }, fd);
        setState(result);
        if (result.ok) {
          formRef.current?.reset();
          setRecipient("");
        }
      } catch {
        setState({ ok: false, error: "Something went wrong. Please try again." });
      }
    });
  }

  const list = q.length > 0 ? results : suggestions;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="recipient"
          className="block text-sm font-medium text-fg"
        >
          To
        </label>
        <input
          id="recipient"
          name="recipient"
          required
          autoComplete="off"
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            // The debounced-effect path owns the fetch + result state; the
            // spinner is an event-derived flag, reset when results land.
            setSearching(e.target.value.trim().length > 0);
          }}
          disabled={isPending}
          placeholder="Search by name or @username"
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />

        <div className="mt-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {q.length > 0 ? "Search results" : "People you follow or message"}
          </p>
          {list.length === 0 ? (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-muted">
              {searching
                ? "Searching…"
                : q.length > 0
                  ? "No one found. Check the spelling or type the exact username above."
                  : "Follow people or start a conversation and they'll show up here."}
            </p>
          ) : (
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
              {list.map((person) => {
                const selected = q.length > 0 && person.username === q;
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setRecipient(person.username)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle ${
                        selected ? "bg-surface-subtle" : ""
                      }`}
                    >
                      <Avatar person={person} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">
                          {person.display_name ?? person.username}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          @{person.username}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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

      {!state.ok && <p className="text-xs text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending || !hydrated}
        className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Starting…" : "Start conversation"}
      </button>
    </form>
  );
}
