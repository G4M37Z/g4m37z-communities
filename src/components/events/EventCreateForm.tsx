"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEventAction } from "@/lib/events/actions";

export function EventCreateForm({
  communities,
}: {
  communities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    const payload = {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      communityId: formData.get("communityId")
        ? String(formData.get("communityId"))
        : null,
      eventType: String(formData.get("eventType") ?? "event").trim() || "event",
      startTime: String(formData.get("startTime") ?? "") || null,
      endTime: String(formData.get("endTime") ?? "") || null,
      capacity: formData.get("capacity")
        ? Number(formData.get("capacity"))
        : null,
    };

    startTransition(async () => {
      const res = await createEventAction(payload);
      if (res.ok && res.eventId) {
        router.push(`/events/${res.eventId}`);
      } else {
        setError(res.error ?? "Failed to create event");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Title *
        </span>
        <input
          type="text"
          name="title"
          maxLength={200}
          required
          placeholder="e.g. Weekly Gaming Night"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Description
        </span>
        <textarea
          name="description"
          maxLength={8000}
          rows={4}
          placeholder="What is happening? When should people show up?"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Community (optional)
        </span>
        <select
          name="communityId"
          defaultValue=""
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        >
          <option value="">Stand-alone (no community)</option>
          {communities.length === 0 && (
            <option value="" disabled>
              You don&apos;t own any communities yet
            </option>
          )}
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Event type
        </span>
        <input
          type="text"
          name="eventType"
          maxLength={64}
          defaultValue="event"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Starts
        </span>
        <input
          type="datetime-local"
          name="startTime"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Ends
        </span>
        <input
          type="datetime-local"
          name="endTime"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Capacity (optional, 1..1000)
        </span>
        <input
          type="number"
          name="capacity"
          min={1}
          max={1000}
          placeholder="Leave blank for unlimited"
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create draft event"}
        </button>
        <p className="mt-2 text-xs text-text-muted">
          The event is created as a DRAFT. You can publish it from the event
          page once it&apos;s ready.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-sale">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
