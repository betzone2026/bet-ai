import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/components/ui/icon';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';

/**
 * The plan block at the foot of the sidebar: which tier is active and the
 * two limits a user actually runs into. It is a link, because the only
 * useful next action from here is to look at the plan.
 */
export function PlanCard({ plan, className }: { plan: PlanId; className?: string }) {
  const current = getPlan(plan);

  return (
    <Link
      href="/subscription"
      className={cn(
        'block rounded-lg border border-line bg-base p-3 transition-colors duration-fast',
        'hover:border-alpha/40 hover:bg-raised',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Plan</span>
        <span className="font-mono text-small font-medium text-alpha">{current.name}</span>
      </div>
      <p className="tabular mt-1.5 font-mono text-fine leading-relaxed text-muted">
        {formatLimit(current.limits.monteCarloLimit)} paths
        <span className="mx-1 text-line-active">·</span>
        {formatLimit(current.limits.aiQueriesDaily)} AI/day
      </p>
    </Link>
  );
}

/**
 * The same fact compressed to a chip for the top bar, where it sits
 * beside the account controls as a persistent reminder of entitlement.
 */
export function PlanBadge({ plan, className }: { plan: PlanId; className?: string }) {
  const current = getPlan(plan);
  const premium = plan !== 'free';

  return (
    <Link
      href="/subscription"
      title={`${current.name} plan`}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-micro',
        'font-medium uppercase tracking-[0.14em] transition-colors duration-fast',
        premium
          ? 'border-alpha/40 bg-alpha/10 text-alpha hover:border-alpha/70'
          : 'border-line bg-raised text-muted hover:border-line-active hover:text-ink',
        className,
      )}
    >
      {premium && <AppIcon name="shield" size={16} className="h-3 w-3" />}
      {current.name}
    </Link>
  );
}
