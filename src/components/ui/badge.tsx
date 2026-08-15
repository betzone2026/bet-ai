import { cn } from '@/lib/utils';
import { riskLevel, type RiskLevel } from '@/lib/utils';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-raised px-2 py-0.5',
        'font-mono text-[10px] uppercase tracking-[0.14em] text-muted',
        className,
      )}
      {...props}
    />
  );
}

/** Marks any figure that comes from the demo dataset. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn('border-alpha/30 bg-alpha/10 text-alpha', className)} title="Sample data, not a live feed">
      Demo data
    </Badge>
  );
}

/** The counterpart to `DemoBadge`: this screen is reading imported fixtures. */
export function LiveDataBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn('border-up/35 bg-up/10 text-up', className)}
      title="Imported from the configured sports data provider"
    >
      Live data
    </Badge>
  );
}

const QUALITY_STYLES: Record<string, string> = {
  GOOD: 'border-up/35 bg-up/10 text-up',
  PARTIAL: 'border-data/35 bg-data/10 text-data',
  STALE: 'border-alpha/35 bg-alpha/10 text-alpha',
  INVALID: 'border-down/35 bg-down/10 text-down',
};

const QUALITY_TITLES: Record<string, string> = {
  GOOD: 'All expected fields are present and current',
  PARTIAL: 'Some optional data has not been imported yet',
  STALE: 'Imported data is older than its refresh window',
  INVALID: 'Failed validation and is not trusted',
};

/** How complete the stored record is — not how likely an outcome is. */
export function DataQualityBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn(QUALITY_STYLES[status] ?? '', className)} title={QUALITY_TITLES[status] ?? ''}>
      {status.toLowerCase()}
    </Badge>
  );
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'border-up/35 bg-up/10 text-up',
  moderate: 'border-data/35 bg-data/10 text-data',
  elevated: 'border-alpha/35 bg-alpha/10 text-alpha',
  high: 'border-down/35 bg-down/10 text-down',
};

/** Dispersion of simulated outcomes — how unpredictable the fixture is. */
export function RiskPill({ score, className }: { score: number; className?: string }) {
  const level = riskLevel(score);
  return (
    <Badge className={cn(RISK_STYLES[level], className)}>
      {level} risk
    </Badge>
  );
}
