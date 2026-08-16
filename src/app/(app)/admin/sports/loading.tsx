import {
  Skeleton,
  SkeletonCard,
  SkeletonMetricRow,
  SkeletonPageHeader,
  SkeletonTable,
} from '@/components/ui/skeleton';

export default function AdminSportsLoading() {
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
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <SkeletonCard />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      <div className="mt-8">
        <SkeletonTable rows={5} columns={6} />
      </div>
    </>
  );
}
