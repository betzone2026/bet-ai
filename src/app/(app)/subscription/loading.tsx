import { Skeleton, SkeletonPageHeader, SkeletonRegion } from '@/components/ui/skeleton';

export default function SubscriptionLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonRegion label="Loading plans">
        <Skeleton className="mb-6 h-14 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-4 h-7 w-24" />
              <div className="mt-5 space-y-2">
                {Array.from({ length: 4 }, (_, row) => (
                  <Skeleton key={row} className="h-3 w-full" />
                ))}
              </div>
              <Skeleton className="mt-6 h-10 w-full" />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    </>
  );
}
