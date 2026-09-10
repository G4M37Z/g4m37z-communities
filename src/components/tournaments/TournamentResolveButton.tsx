"use client";
// TournamentResolveButton — organiser-only resolve/reject dispute action.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveDisputeAction } from "@/lib/tournaments/actions";

export function TournamentResolveButton({
  disputeId,
}: {
  disputeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(outcome: "RESOLVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const res = await resolveDisputeAction({ disputeId, outcome });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Action failed");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve("RESOLVED")}
          className="press inline-flex h-6 items-center rounded-md bg-accent px-2 text-[10px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve("REJECTED")}
          className="press inline-flex h-6 items-center rounded-md border border-border bg-bg px-2 text-[10px] font-semibold text-text-muted hover:text-fg disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[10px] text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
