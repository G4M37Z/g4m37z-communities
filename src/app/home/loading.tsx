// Route-level loading for /home — feed-shaped skeleton instead of the
// full-screen brand splash, so navigation between content pages never
// flashes the whole app away.
import { FeedSkeleton, PageHeaderSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="container-x py-8 pb-20" aria-busy="true">
      <PageHeaderSkeleton />
      <FeedSkeleton count={5} />
    </main>
  );
}
