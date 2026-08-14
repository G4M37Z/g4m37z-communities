// src/app/home/FeedSortTabs.tsx
// Server-rendered tab links for Latest / Popular / Trending on home feed.

import Link from "next/link";
import type { SortKey } from "@/lib/posts/queries";

interface Props {
  current: SortKey;
}

const TABS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "popular", label: "Popular" },
  { key: "trending", label: "Trending" },
];

export function FeedSortTabs({ current }: Props) {
  return (
    <nav
      aria-label="Sort posts"
      className="flex gap-1 rounded-lg border border-border bg-surface p-1 mb-6"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={`/home?sort=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
              isActive
                ? "bg-bg text-fg"
                : "text-text-muted hover:bg-bg/60 hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
