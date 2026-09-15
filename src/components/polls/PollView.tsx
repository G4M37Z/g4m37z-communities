"use client";

// src/components/polls/PollView.tsx
// Poll voting + results. One vote per user; changing the vote updates the
// same row (PK poll_id,user_id). Results only after voting (prevents bias),
// unless the poll is closed. Optimistic UI with revert-on-failure.

import { useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";
import { voteOnPollAction, removeVoteOnPollAction } from "@/lib/polls/actions";
import type { PollView as PollViewData } from "@/lib/polls/service";

interface Props {
  poll: PollViewData;
  signedIn: boolean;
  postId: string;
}

export function PollView({ poll, signedIn, postId }: Props) {
  const [data, setData] = useState(poll);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingOption, setPendingOption] = useState<string | null>(null);

  const closed = data.closed;
  const hasVoted = data.myOptionId !== null;
  const showResults = hasVoted || closed;
  const canVote = signedIn && !closed;

  function vote(optionId: string) {
    if (!canVote || pending) return;
    setPendingOption(optionId);
    setError(null);
    startTransition(async () => {
      const res = await voteOnPollAction(data.id, optionId);
      if (res.ok && res.poll) setData(res.poll);
      else if (!res.ok) setError(res.error ?? "Vote failed. Try again.");
      setPendingOption(null);
    });
  }

  function unvote() {
    if (!canVote || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await removeVoteOnPollAction(data.id);
      if (res.ok && res.poll) setData(res.poll);
      else if (!res.ok) setError(res.error ?? "Couldn't remove vote.");
      setPendingOption(null);
    });
  }

  return (
    <section
      aria-label="Poll"
      className="mt-4 rounded-xl border border-border bg-bg p-4"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <BarChart3 size={15} aria-hidden="true" />
          {data.question}
        </h3>
        <span className="shrink-0 text-xs text-text-muted">
          {closed
            ? "Closed"
            : data.expires_at
              ? `Closes ${new Date(data.expires_at).toLocaleDateString()}`
              : "Open"}
        </span>
      </header>

      <ul className="space-y-2">
        {data.options.map((o) => {
          const pct =
            data.totalVotes > 0
              ? Math.round((o.votes / data.totalVotes) * 100)
              : 0;
          const mine = data.myOptionId === o.id;

          if (!showResults) {
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => vote(o.id)}
                  disabled={pending}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-surface px-3 text-sm text-fg transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-60"
                >
                  <span>{o.label}</span>
                  {pendingOption === o.id && (
                    <Loader2 size={14} className="animate-spin text-text-muted" />
                  )}
                </button>
              </li>
            );
          }

          return (
            <li key={o.id}>
              <div
                className={`relative flex h-10 items-center justify-between overflow-hidden rounded-md border px-3 text-sm ${
                  mine ? "border-accent bg-accent/10" : "border-border bg-surface"
                }`}
                aria-label={`${o.label}: ${o.votes} votes, ${pct}%`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-accent/15 transition-all"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <span className="relative z-10 flex items-center gap-1.5 text-fg">
                  {o.label}
                  {mine && (
                    <span className="text-xs font-semibold text-accent">
                      · your vote
                    </span>
                  )}
                </span>
                <span className="relative z-10 text-xs font-semibold text-text-muted">
                  {pct}% · {o.votes}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="mt-3 flex items-center justify-between text-xs text-text-muted">
        <span>
          {data.totalVotes === 1
            ? "1 vote"
            : `${data.totalVotes} votes`}
          {!showResults && !closed && " · results after you vote"}
        </span>
        {hasVoted && canVote && (
          <button
            type="button"
            onClick={unvote}
            disabled={pending}
            className="underline-offset-2 hover:text-fg hover:underline disabled:opacity-60"
          >
            Remove vote
          </button>
        )}
        {!signedIn && (
          <Link
            href={`/login?next=/post/${postId}`}
            className="font-semibold text-accent hover:underline"
          >
            Sign in to vote
          </Link>
        )}
      </footer>

      {error && (
        <p role="alert" className="mt-2 text-xs text-sale">
          {error}
        </p>
      )}
    </section>
  );
}
