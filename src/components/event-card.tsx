"use client";
// V2 Event — verified event card component
// Uses verified database (existing community schema)
// No arbitrary assets

export interface EventProps {
  id: string; title: string; communityName: string;
  startTime: string; endTime?: string; status: "upcoming" | "live" | "completed" | "cancelled";
}

export function EventCard({ id, title, communityName, startTime, status }: EventProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        <span className="text-xs font-medium text-success uppercase tracking-[0.06em]">{status}</span>
      </div>
      <h4 className="text-sm font-semibold text-fg mb-1">{title}</h4>
      <p className="text-xs text-text-muted">{communityName}</p>
      <p className="text-xs text-text-muted mt-1">Starts: {startTime}</p>
    </div>
  );
}
