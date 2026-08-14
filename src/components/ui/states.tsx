import { cn } from '@/lib/utils';

/** An empty screen is an invitation to act, so it always offers one. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line',
        'bg-surface/40 px-6 py-14 text-center',
        className,
      )}
    >
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** States what went wrong and what to do about it. No apology. */
export function ErrorState({
  title = 'Something failed to load',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-down/30 bg-down/[0.06] px-5 py-6', className)}>
      <p className="eyebrow text-down">Error</p>
      <h3 className="mt-1 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:border-muted"
        >
          Try again
        </button>
      )}
    </div>
  );
}
