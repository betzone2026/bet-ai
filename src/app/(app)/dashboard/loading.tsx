import { SkeletonPage } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return <SkeletonPage metrics={4} cards={6} />;
}
