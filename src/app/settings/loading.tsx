// Route-level loading for /settings — form-shaped skeleton.
import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-8 pb-24" aria-busy="true">
      <PageHeaderSkeleton />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-5 rounded-lg border border-border bg-surface p-5">
          <Skeleton className="mb-3 h-4 w-32" />
          <Skeleton className="mb-2 h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}
