import { SkeletonPageHeader, SkeletonMetricRow, SkeletonTable } from '@/components/ui/skeleton';

export default function HistoryLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <div className="pb-8">
        <SkeletonMetricRow count={3} />
      </div>
      <SkeletonTable rows={8} columns={5} />
    </>
  );
}
