import { cn, riskLevel, type RiskLevel } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import type { IconName } from '@/lib/icons';

/**
 * Badges carry one word of state, and colour is the only thing that
 * distinguishes them, so the variants are fixed and named after meaning
 * rather than appearance: a caller asks for `danger`, never for red.
 */
export type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'premium';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'border-line bg-raised text-muted',
  info: 'border-info/35 bg-info/10 text-info',
  success: 'border-up/35 bg-up/10 text-up',
  warning: 'border-warn/35 bg-warn/10 text-warn',
  danger: 'border-down/35 bg-down/10 text-down',
  premium: 'border-alpha/35 bg-alpha/10 text-alpha',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: IconName;
  /** A pulsing dot, for states that are true right now rather than stored. */
  dot?: boolean;
}

export function Badge({
  variant = 'neutral',
  icon,
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5',
        'font-mono text-micro uppercase leading-4 tracking-[0.12em]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />}
      {icon && <AppIcon name={icon} size={16} className="h-3 w-3" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------
   Data provenance. Which of these appears is the first thing a reader
   should be able to check on any screen, so they share a shape and
   differ only in colour and word.
   ------------------------------------------------------------------ */

export type DataStatus = 'LIVE' | 'DEMO' | 'PARTIAL' | 'STALE';

const DATA_STATUS: Record<DataStatus, { label: string; variant: BadgeVariant; title: string }> = {
  LIVE: {
    label: 'Live data',
    variant: 'success',
    title: 'Imported from the configured sports data provider',
  },
  DEMO: {
    label: 'Demo data',
    variant: 'premium',
    title: 'Sample dataset used to build the interface, not a live feed',
  },
  PARTIAL: {
    label: 'Partial data',
    variant: 'info',
    title: 'Some optional data has not been imported yet',
  },
  STALE: {
    label: 'Stale data',
    variant: 'warning',
    title: 'Imported data is older than its refresh window',
  },
};

export function StatusBadge({ status, className }: { status: DataStatus; className?: string }) {
  const config = DATA_STATUS[status];
  return (
    <Badge
      variant={config.variant}
      dot={status === 'LIVE'}
      className={className}
      title={config.title}
    >
      {config.label}
    </Badge>
  );
}

/** Kept as named shorthands because both read better at the call site. */
export function DemoBadge({ className }: { className?: string }) {
  return <StatusBadge status="DEMO" className={className} />;
}

export function LiveDataBadge({ className }: { className?: string }) {
  return <StatusBadge status="LIVE" className={className} />;
}

/* ------------------------------------------------------------------
   Record completeness — how much of a stored fixture arrived, which is
   a different question from how likely an outcome is.
   ------------------------------------------------------------------ */

const QUALITY_VARIANT: Record<string, BadgeVariant> = {
  GOOD: 'success',
  PARTIAL: 'info',
  STALE: 'warning',
  INVALID: 'danger',
};

const QUALITY_TITLES: Record<string, string> = {
  GOOD: 'All expected fields are present and current',
  PARTIAL: 'Some optional data has not been imported yet',
  STALE: 'Imported data is older than its refresh window',
  INVALID: 'Failed validation and is not trusted',
};

export function DataQualityBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant={QUALITY_VARIANT[status] ?? 'neutral'}
      className={className}
      title={QUALITY_TITLES[status] ?? ''}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

/* ------------------------------------------------------------------
   Risk. The label is not self-explanatory, so it always carries the
   explanation with it rather than assuming the reader knows.
   ------------------------------------------------------------------ */

const RISK_VARIANT: Record<RiskLevel, BadgeVariant> = {
  low: 'success',
  moderate: 'info',
  elevated: 'warning',
  high: 'danger',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Medium',
  elevated: 'High',
  high: 'Very high',
};

const RISK_EXPLANATION: Record<RiskLevel, string> = {
  low: 'Simulated outcomes cluster tightly. The model finds this fixture predictable.',
  moderate: 'Simulated outcomes are moderately spread. A normal amount of uncertainty.',
  elevated: 'Simulated outcomes are widely spread. Small changes in inputs move the result.',
  high: 'Simulated outcomes are close to evenly spread. The model has little to distinguish the results.',
};

/**
 * Risk is dispersion of simulated outcomes, not a probability of losing.
 * The tooltip says so on every instance, because that is precisely the
 * confusion the label invites.
 */
export function RiskBadge({
  score,
  className,
  withTooltip = true,
}: {
  score: number;
  className?: string;
  withTooltip?: boolean;
}) {
  const level = riskLevel(score);
  const badge = (
    <Badge variant={RISK_VARIANT[level]} className={className}>
      {RISK_LABEL[level]} risk
    </Badge>
  );

  if (!withTooltip) return badge;

  return (
    <Tooltip content={<><strong className="text-ink">{RISK_LABEL[level]} risk.</strong> {RISK_EXPLANATION[level]}</>}>
      {badge}
    </Tooltip>
  );
}

/** Previous name for the same control, kept so call sites read consistently. */
export const RiskPill = RiskBadge;

/**
 * The gap between the model's probability and the market's implied one.
 * Direction is the whole point, so it is the only thing coloured.
 */
export function ValueBadge({ edge, className }: { edge: number; className?: string }) {
  const positive = edge > 0;
  const flat = Math.abs(edge) < 0.005;
  return (
    <Badge
      variant={flat ? 'neutral' : positive ? 'success' : 'danger'}
      icon={flat ? undefined : positive ? 'up' : 'down'}
      className={className}
      title="Model probability minus the probability implied by the market price"
    >
      {positive ? '+' : ''}
      {(edge * 100).toFixed(1)}%
    </Badge>
  );
}
