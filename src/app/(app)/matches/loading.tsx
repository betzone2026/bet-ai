import {
  Skeleton,
  SkeletonCardGrid,
  SkeletonPageHeader,
  SkeletonRegion,
} from '@/components/ui/skeleton';

/** The list carries a date and status strip above the cards, so the
    placeholder reserves that row rather than letting the grid jump up. */
export default function MatchesLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonRegion
        label="Loading filters"
        className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="ml-auto h-5 w-24" />
      </SkeletonRegion>
      <SkeletonCardGrid count={6} />
    </>
  );
}
