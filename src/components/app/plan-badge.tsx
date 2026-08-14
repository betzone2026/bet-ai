import Link from 'next/link';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';

export function PlanBadge({ plan }: { plan: PlanId }) {
  const current = getPlan(plan);
  return (
    <Link
      href="/subscription"
      className="block rounded-lg border border-line bg-base p-3 transition-colors hover:border-alpha/40"
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">Plan</span>
        <span className="font-mono text-xs text-alpha">{current.name}</span>
      </div>
      <p className="tabular mt-2 font-mono text-[11px] text-muted">
        {formatLimit(current.limits.monteCarloLimit)} paths · {formatLimit(current.limits.aiQueriesDaily)} AI/day
      </p>
    </Link>
  );
}
