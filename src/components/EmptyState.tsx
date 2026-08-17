// src/components/EmptyState.tsx
// Reusable empty-state UI for any list view (communities, posts, comments, etc).
// Standardizes padding, icon slot, headline, body, and optional CTA.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-12 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={36} className="mx-auto mb-4 text-text-muted" aria-hidden="true" />
      <h2 className="mb-2 text-lg font-bold text-fg">{title}</h2>
      {body && (
        <p className="mx-auto mb-6 max-w-md text-sm text-text-muted">{body}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link
              href={action.href}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}