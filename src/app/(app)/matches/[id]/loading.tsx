import { Skeleton, SkeletonCard, SkeletonRegion } from '@/components/ui/skeleton';

/** Fixture header, tab strip, then the panel — the same three bands the
    loaded screen uses, so nothing moves when the data lands. */
export default function MatchDetailLoading() {
  return (
    <SkeletonRegion label="Loading fixture">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <Skeleton className="h-3 w-32" />
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-8 w-16" />
          <div className="flex items-center justify-end gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
        <Skeleton className="mt-5 h-3 w-48" />
      </div>

      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-28 shrink-0" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </SkeletonRegion>
  );
}
