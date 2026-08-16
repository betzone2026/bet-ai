import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import type { IconName } from '@/lib/icons';

export type MetricTrend = 'up' | 'down' | 'flat';

/**
 * A single figure with its caption, an icon and an optional trend.
 *
 * Compact by design: the KPI row is a scan, not a read. The number is
 * monospace so a row of them lines up on the decimal point, and the
 * accent is reserved for the one metric on a screen that should be
 * looked at first.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  trend?: MetricTrend;
  /** The words beside the trend arrow, e.g. "vs. yesterday". */
  trendLabel?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card hairline-top',
        'transition-colors duration-base hover:border-line-active',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{label}</p>
        {icon && <AppIcon name={icon} size={16} className="text-muted" />}
      </div>

      <p
        className={cn(
          'tabular mt-2 font-mono text-data font-medium',
          accent ? 'text-alpha' : 'text-ink',
        )}
      >
        {value}
      </p>

      {(hint || trend) && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {trend && trend !== 'flat' && (
            <AppIcon
              name={trend}
              size={16}
              className={cn('h-3.5 w-3.5', trend === 'up' ? 'text-up' : 'text-down')}
              label={trend === 'up' ? 'Trending up' : 'Trending down'}
            />
          )}
          <p className="truncate text-fine text-muted">{trendLabel ?? hint}</p>
        </div>
      )}
    </div>
  );
}

/** The previous name for the same control; both read fine at call sites. */
export const Stat = MetricCard;
