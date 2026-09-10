"use client";
// TournamentDisputeForm — any authenticated user can raise a dispute on
// any match. raiser = auth.uid() enforced server-side.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDisputeAction } from "@/lib/tournaments/actions";

export function TournamentDisputeForm({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const r = reason.trim();
    if (r.length === 0) {
      setError("Provide a reason");
      return;
    }
    startTransition(async () => {
      const res = await createDisputeAction({ matchId, reason: r });
      if (res.ok) {
        setReason("");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to raise dispute");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex h-7 items-center rounded-md border border-border bg-bg px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-fg"
      >
        Raise dispute
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={4000}
        rows={2}
        placeholder="What happened?"
        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="press inline-flex h-7 items-center rounded-md bg-accent px-2 text-[10px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          className="press inline-flex h-7 items-center rounded-md border border-border bg-bg px-2 text-[10px] font-semibold text-text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
