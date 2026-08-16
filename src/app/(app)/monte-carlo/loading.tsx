import { Skeleton, SkeletonPageHeader, SkeletonRegion } from '@/components/ui/skeleton';

/** Control column beside the result column, which is how the lab is laid
    out once it has something to show. */
export default function MonteCarloLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonRegion
        label="Loading simulation lab"
        className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start"
      >
        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-5 h-3 w-20" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
          <Skeleton className="mt-5 h-3 w-24" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
          <Skeleton className="mt-6 h-12 w-full" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-6 w-2/3" />
          <Skeleton className="mt-6 h-3 w-full" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        </div>
      </SkeletonRegion>
    </>
  );
}
