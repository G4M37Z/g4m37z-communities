// Route-level loading for /discover — cover-tile grid skeleton.
import { PageHeaderSkeleton, TileGridSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="container-x py-8 pb-20" aria-busy="true">
      <PageHeaderSkeleton />
      <TileGridSkeleton count={6} />
    </main>
  );
}
