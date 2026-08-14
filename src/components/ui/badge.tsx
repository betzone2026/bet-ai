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
