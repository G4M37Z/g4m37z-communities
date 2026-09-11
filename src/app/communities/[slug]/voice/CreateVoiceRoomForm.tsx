"use client";
// Create voice room form — persists via createVoiceRoom server action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createVoiceRoom } from "@/lib/voice/actions";

export function CreateVoiceRoomForm({ communityId }: { communityId: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await createVoiceRoom(communityId, name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      router.push(`/voice/${res.roomId}`);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <h3 className="mb-2 text-sm font-bold text-fg">Create a room</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Room name (e.g. Squad Up Live)"
          maxLength={60}
          required
          className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="press inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={16} />
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </form>
  );
}