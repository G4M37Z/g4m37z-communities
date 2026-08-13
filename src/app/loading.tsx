// src/app/loading.tsx
// Shown while route segments are loading (e.g. Supabase query in flight).
// Skeletons match the G4M37Z Communities color tokens.

export default function Loading() {
  return (
    <main className="container-x py-12 sm:py-16">
      {/* Hero skeleton */}
      <div className="mb-12 h-40 w-full animate-pulse rounded-2xl bg-surface sm:h-48" />

      {/* Section heading skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded bg-surface" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface" />
      </div>

      {/* Feed skeleton — list of post cards */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-bg" />
              <div className="h-3 w-24 animate-pulse rounded bg-bg" />
            </div>
            <div className="h-5 w-3/4 animate-pulse rounded bg-bg" />
            <div className="h-4 w-full animate-pulse rounded bg-bg" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-bg" />
          </div>
        ))}
      </div>
    </main>
  );
}
