import { Skeleton, SkeletonPageHeader, SkeletonRegion } from '@/components/ui/skeleton';

/** Fixture list, conversation, context column. */
export default function AnalystLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonRegion
        label="Loading analyst"
        className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_17rem] lg:items-start"
      >
        <div className="rounded-xl border border-line bg-surface p-3 shadow-card">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="mb-2 h-11 w-full" />
          ))}
        </div>
        <div className="flex min-h-[30rem] flex-col rounded-xl border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-2 h-3 w-36" />
          <div className="mt-auto space-y-3">
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <div className="hidden rounded-xl border border-line bg-surface p-4 shadow-card xl:block">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-4 h-16 w-full" />
          <Skeleton className="mt-4 h-16 w-full" />
        </div>
      </SkeletonRegion>
    </>
  );
}
