// src/components/Pagination.tsx
// Server-rendered prev/next pagination links. URL-driven (?page=N).
// Hides when total is unknown or <= limit.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  basePath: string;
  // Additional query params to preserve (sort, q, etc.)
  extraParams?: Record<string, string | undefined>;
  page: number;
  limit: number;
  // Pass `hasMore=true` if the next page is likely to have items.
  // Conservative: pass `false` when the last page returned fewer than `limit`.
  hasMore: boolean;
}

export function Pagination({
  basePath,
  extraParams,
  page,
  hasMore,
}: Props) {
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = hasMore ? page + 1 : null;
  if (!prevPage && !nextPage) return null;

  function buildHref(p: number): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-between text-sm"
    >
      {prevPage ? (
        <Link
          href={buildHref(prevPage)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-fg hover:border-accent/60"
        >
          <ChevronLeft size={14} />
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-text-muted">Page {page}</span>
      {nextPage ? (
        <Link
          href={buildHref(nextPage)}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 text-fg hover:border-accent/60"
        >
          Next
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}