// src/components/Skeleton.tsx
// Reusable skeleton primitives. Calm shimmer, no flash.

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function PostCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <PostCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Avatar + two lines — conversations, notifications, member lists. */
export function ListRowSkeleton({ avatarSize = "h-10 w-10" }: { avatarSize?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className={`${avatarSize} shrink-0 rounded-full`} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function ListSkeleton({
  count = 6,
  avatarSize,
}: {
  count?: number;
  avatarSize?: string;
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <ListRowSkeleton key={i} avatarSize={avatarSize} />
      ))}
    </div>
  );
}

/** 2:3 cover tiles — the games grid on /discover. */
export function TileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
      ))
      }
    </div>
  );
}

/** Standard page header placeholder — title bar + one action. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-28 rounded-md" />
    </div>
  );
}