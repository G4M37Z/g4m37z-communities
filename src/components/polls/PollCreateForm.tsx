"use client";

// src/components/polls/PollCreateForm.tsx
// Lets the post author attach a poll to their own post (one per post).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, Plus, X } from "lucide-react";
import { createPollAction } from "@/lib/polls/actions";

interface Props {
  postId: string;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export function PollCreateForm({ postId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [expiresInHours, setExpiresInHours] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:border-accent/60 hover:text-fg"
      >
        <BarChart3 size={14} />
        Attach a poll
      </button>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPollAction(postId, {
        question,
        options,
        expiresInHours: expiresInHours ? Number(expiresInHours) : null,
      });
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <BarChart3 size={15} aria-hidden="true" /> New poll
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel poll"
          className="text-text-muted hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      <label htmlFor="poll-question" className="mb-1 block text-xs font-medium text-fg">
        Question
      </label>
      <input
        id="poll-question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={300}
        placeholder="Which game should we play this weekend?"
        className="mb-3 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <fieldset className="mb-3">
        <legend className="mb-1 text-xs font-medium text-fg">
          Options ({MIN_OPTIONS}–{MAX_OPTIONS})
        </legend>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                maxLength={120}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  aria-label={`Remove option ${i + 1}`}
                  className="shrink-0 px-2 text-text-muted hover:text-sale"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="mt-2 inline-flex items-center gap-1 text-xs text-text-muted hover:text-fg"
          >
            <Plus size={12} /> Add option
          </button>
        )}
      </fieldset>

      <label htmlFor="poll-expiry" className="mb-1 block text-xs font-medium text-fg">
        Closes after <span className="text-text-muted">(optional)</span>
      </label>
      <select
        id="poll-expiry"
        value={expiresInHours}
        onChange={(e) => setExpiresInHours(e.target.value)}
        className="mb-3 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        <option value="">Never</option>
        <option value="24">1 day</option>
        <option value="72">3 days</option>
        <option value="168">1 week</option>
      </select>

      {error && (
        <p role="alert" className="mb-2 text-xs text-sale">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || question.trim().length === 0}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Creating…
          </>
        ) : (
          "Create poll"
        )}
      </button>
    </div>
  );
}
