// Route-level loading for /communities — card-grid skeleton.
import { PageHeaderSkeleton, Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="container-x py-8 pb-20" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
