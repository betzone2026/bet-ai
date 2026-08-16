import { SkeletonPageHeader, SkeletonCardGrid } from '@/components/ui/skeleton';

export default function PortfolioLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonCardGrid count={5} />
    </>
  );
}
