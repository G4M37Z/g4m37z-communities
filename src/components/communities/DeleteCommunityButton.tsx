"use client";

// src/components/communities/DeleteCommunityButton.tsx
// Owner-only destructive action. Requires typing the community slug to confirm.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCommunity } from "@/lib/communities/actions";

interface Props {
  communityId: string;
  slug: string;
}

export function DeleteCommunityButton({ communityId, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCommunity(communityId);
      if (res.ok) {
        router.push("/communities");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section className="rounded-lg border border-red/40 bg-surface p-4">
      <h3 className="text-base font-bold text-fg">Danger zone</h3>
      <p className="mt-1 text-xs text-text-muted">
        Deleting a community permanently removes its posts, events, and members. This cannot be undone.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-red/50 px-3 text-sm font-semibold text-red hover:bg-red/10"
        >
          <Trash2 size={14} />
          Delete community
        </button>
      ) : (
        <div className="mt-3">
          <label htmlFor="delete-confirm" className="block text-xs font-semibold text-fg">
            Type <span className="font-mono text-red">{slug}</span> to confirm
          </label>
          <input
            id="delete-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending || confirmation !== slug}
              className="press inline-flex h-9 items-center gap-2 rounded-md bg-red px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
              disabled={pending}
              className="press inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-fg hover:bg-surface-subtle"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
