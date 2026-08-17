// src/components/Pagination.tsx
// Server-rendered prev/next pagination links. URL-driven (?page=N).
// Hides when total is unknown or <= limit.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  basePath: string;
  extraParams?: Record<string, string | undefined>;
  page: number;
  limit: number;
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

  const linkClass =
    "press inline-flex items-center gap-1 rounded-md border border-border bg-surface " +
    "px-3 py-2 text-sm text-fg hover:bg-surface-subtle hover:border-border-strong " +
    "transition-colors";

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-between text-sm"
    >
      {prevPage ? (
        <Link href={buildHref(prevPage)} className={linkClass}>
          <ChevronLeft size={14} />
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-text-muted">Page {page}</span>
      {nextPage ? (
        <Link href={buildHref(nextPage)} className={linkClass}>
          Next
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}