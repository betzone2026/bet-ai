import { SkeletonPageHeader, SkeletonCard, SkeletonRegion } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <>
      <SkeletonPageHeader />
      <SkeletonRegion label="Loading settings" className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </SkeletonRegion>
    </>
  );
}
