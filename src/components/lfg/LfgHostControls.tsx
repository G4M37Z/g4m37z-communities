"use client";
// LfgHostControls — host-only close/cancel/delete actions. Server enforces
// host ownership; this component just provides the UI.
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closeLfgAction,
  cancelLfgAction,
  deleteLfgAction,
} from "@/lib/lfg/actions";

export function LfgHostControls({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action(sessionId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error ?? "Action failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(closeLfgAction)}
        className="press inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg hover:border-border-strong disabled:opacity-60"
      >
        Close
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(cancelLfgAction)}
        className="press inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-fg hover:border-border-strong disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(deleteLfgAction)}
        className="press inline-flex h-9 items-center rounded-md border border-sale bg-bg px-3 text-xs font-semibold text-sale hover:bg-sale hover:text-white disabled:opacity-60"
      >
        Delete
      </button>
      {error && (
        <p role="alert" className="text-xs text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
