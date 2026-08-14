import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-raised', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-4 h-2.5 w-full" />
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  );
}
