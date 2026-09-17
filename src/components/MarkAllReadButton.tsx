"use client";

// src/components/MarkAllReadButton.tsx
// Optimistic "mark all as read": hides itself immediately, reconciles the
// server-rendered list via router.refresh(), and rolls back on failure.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export function MarkAllReadButton() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setDone(true);
    setPending(true);
    try {
      await markAllNotificationsRead();
      router.refresh();
    } catch {
      setDone(false);
    } finally {
      setPending(false);
    }
  }

  if (done) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60 sm:mt-0"
    >
      <CheckCheck size={14} />
      Mark all as read
    </button>
  );
}
