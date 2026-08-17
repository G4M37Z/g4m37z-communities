// src/components/EmptyState.tsx
// Reusable empty-state UI. Calm typography, single accent at most.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
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
      className={`rounded-lg border border-border bg-surface p-10 text-center sm:p-14 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        size={32}
        className="mx-auto mb-4 text-text-muted"
        aria-hidden="true"
        strokeWidth={1.5}
      />
      <h2 className="mb-2 text-base font-semibold text-fg">{title}</h2>
      {body && (
        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
          {body}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Link
              href={action.href}
              className="press inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="press inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-surface"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}