// Route-level loading for /messages — conversation-list skeleton.
import { ListSkeleton, PageHeaderSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="container-x py-8 pb-20" aria-busy="true">
      <PageHeaderSkeleton />
      <ListSkeleton count={6} />
    </main>
  );
}
