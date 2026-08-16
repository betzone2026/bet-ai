import { cn } from '@/lib/utils';

/**
 * Skeletons, not spinners.
 *
 * Every screen that waits for data renders the shape it is about to show.
 * A centred spinner tells the reader only that something is happening; a
 * skeleton tells them what is coming and stops the layout jumping when it
 * arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-raised', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

/** Wraps a loading region so assistive technology is told to wait. */
export function SkeletonRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-card', className)}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-4 h-2 w-full" />
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  );
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card', className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-16" />
      <Skeleton className="mt-2.5 h-2.5 w-24" />
    </div>
  );
}

export function SkeletonMetricRow({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRegion label="Loading metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonMetric key={index} />
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <SkeletonRegion
      label="Loading fixtures"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </SkeletonRegion>
  );
}

export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <SkeletonRegion
      label="Loading table"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="border-b border-line px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={cn('h-3', column === 0 ? 'w-1/3' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Kept under its original name; the match list imports it directly. */
export const MatchCardSkeleton = SkeletonCard;

/** The heading block, so a route's `loading.tsx` reserves its real height. */
export function SkeletonPageHeader({ className }: { className?: string }) {
  return (
    <div className={cn('pb-6', className)} aria-hidden>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-56" />
      <Skeleton className="mt-3 h-3.5 w-72" />
    </div>
  );
}

/**
 * The default loading shape: heading, a metric row and a card grid. Routes
 * whose content differs enough compose the parts themselves.
 */
export function SkeletonPage({
  metrics = 4,
  cards = 6,
}: {
  metrics?: number;
  cards?: number;
}) {
  return (
    <>
      <SkeletonPageHeader />
      {metrics > 0 && <SkeletonMetricRow count={metrics} />}
      {cards > 0 && (
        <div className="mt-10">
          <SkeletonCardGrid count={cards} />
        </div>
      )}
    </>
  );
}
