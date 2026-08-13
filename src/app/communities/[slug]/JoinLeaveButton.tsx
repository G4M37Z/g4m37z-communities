"use client";

// src/app/communities/[slug]/JoinLeaveButton.tsx
// Client component for join/leave interaction. Calls server actions,
// manages pending state, refreshes the page on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { joinCommunity, leaveCommunity } from "@/lib/communities/actions";

interface Props {
  communityId: string;
  currentRole: "member" | "moderator" | "admin" | null;
}

export function JoinLeaveButton({ communityId, currentRole }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (currentRole) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await leaveCommunity(communityId);
              if (res.error) {
                setError(res.error);
                return;
              }
              router.refresh();
            });
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-fg hover:border-sale hover:text-sale disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <LogOut size={14} />
          )}
          {currentRole === "admin" ? "Leave (admin)" : "Leave"}
        </button>
        {error && (
          <p className="max-w-xs text-right text-xs text-sale">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await joinCommunity(communityId);
            if (res.error) {
              setError(res.error);
              return;
            }
            router.refresh();
          });
        }}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <LogIn size={14} />
        )}
        Join
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-sale">{error}</p>
      )}
    </div>
  );
}
