import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { IconName } from '@/lib/icons';

/**
 * An empty screen is an invitation to act, so it always offers one thing
 * to do. The icon is muted and small — an empty state should look
 * deliberate, not like an error someone forgot to handle.
 */
export function EmptyState({
  icon = 'search',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line',
        'bg-surface/40 px-6 py-12 text-center sm:py-14',
        className,
      )}
    >
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-raised">
        <AppIcon name={icon} size={20} className="text-muted" />
      </span>
      <h3 className="font-display text-h3 font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-small text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * States what went wrong and what to do about it. No apology.
 *
 * `detail` is the technical reading — a status code, a provider message,
 * an exception summary. It is rendered only when `showDetail` is set,
 * which the admin screens do and the user-facing screens do not: an
 * operator needs the cause, a subscriber needs the consequence.
 */
export function ErrorState({
  title = 'Something failed to load',
  description,
  detail,
  showDetail = false,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  detail?: string | null;
  showDetail?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('rounded-xl border border-down/30 bg-down/[0.06] px-5 py-5', className)}
    >
      <div className="flex items-start gap-3">
        <AppIcon name="alert" size={18} className="mt-0.5 text-down" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-h3 font-semibold">{title}</h3>
          <p className="mt-1 text-small text-muted">{description}</p>

          {showDetail && detail && (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-down/25 bg-base/60 px-3 py-2 font-mono text-fine leading-relaxed text-down">
              {detail}
            </pre>
          )}

          {onRetry && (
            <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry} className="mt-4">
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A feature the current plan does not include. Distinct from an empty
 * state: nothing is missing, the reader simply does not have it yet.
 */
export function UpgradeState({
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
        'rounded-xl border border-alpha/25 bg-alpha/[0.04] px-6 py-12 text-center sm:py-14',
        className,
      )}
    >
      <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-alpha/30 bg-alpha/10">
        <AppIcon name="subscription" size={20} className="text-alpha" />
      </span>
      <h3 className="font-display text-h3 font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-small text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * The standing note that sits at the foot of a data screen. One shape for
 * all of them, so the reader learns to recognise it and can skip it.
 */
export function Note({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  className?: string;
}) {
  const TONES = {
    neutral: 'border-line bg-surface/50 text-muted',
    warning: 'border-alpha/25 bg-alpha/[0.05] text-muted',
    danger: 'border-down/30 bg-down/[0.05] text-down',
  } as const;

  return (
    <p
      className={cn(
        'rounded-xl border px-4 py-3 text-fine leading-relaxed',
        TONES[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}
