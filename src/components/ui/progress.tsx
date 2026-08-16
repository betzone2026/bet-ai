import { cn } from '@/lib/utils';

export type ProgressTone = 'accent' | 'info' | 'positive' | 'warning' | 'danger';

const TONES: Record<ProgressTone, string> = {
  accent: 'bg-alpha',
  info: 'bg-info',
  positive: 'bg-up',
  warning: 'bg-warn',
  danger: 'bg-down',
};

/**
 * A measured quantity against a known ceiling — request quota, simulation
 * progress, a share of a market. Flat fill, no gradient, no stripes: the
 * only thing the reader should take from it is the ratio.
 */
export function ProgressBar({
  value,
  max = 1,
  label,
  valueLabel,
  tone = 'accent',
  size = 'md',
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  /** Rendered opposite the label; falls back to a percentage. */
  valueLabel?: string;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && <span className="eyebrow truncate">{label}</span>}
          <span className="tabular shrink-0 font-mono text-small text-ink">
            {valueLabel ?? `${Math.round(ratio * 100)}%`}
          </span>
        </div>
      )}
      <div
        className={cn(
          'mt-1.5 overflow-hidden rounded-sm bg-raised',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={cn('h-full transition-[width] duration-base ease-ease', TONES[tone])}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A horizontal bar chart row: label, proportional bar, figure. The bar is
 * scaled against the largest value in its group rather than against 100%,
 * so a set of small probabilities is still readable.
 */
export function BarRow({
  label,
  value,
  scale = 1,
  display,
  tone = 'accent',
  className,
}: {
  label: string;
  value: number;
  /** The group's maximum, used as the bar's full width. */
  scale?: number;
  display: string;
  tone?: ProgressTone;
  className?: string;
}) {
  const width = scale > 0 ? Math.min((value / scale) * 100, 100) : 0;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="tabular w-14 shrink-0 font-mono text-small text-muted">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-raised">
        <div
          className={cn('h-full transition-[width] duration-base ease-ease', TONES[tone])}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="tabular w-14 shrink-0 text-right font-mono text-small">{display}</span>
    </div>
  );
}
