import { Skeleton, SkeletonMetricRow, SkeletonPageHeader, SkeletonTable } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-28" />
        ))}
      </div>
      <SkeletonMetricRow count={4} />
      <div className="mt-3">
        <SkeletonMetricRow count={4} />
      </div>
      <div className="mt-8">
        <SkeletonTable rows={6} columns={4} />
      </div>
    </>
  );
}
