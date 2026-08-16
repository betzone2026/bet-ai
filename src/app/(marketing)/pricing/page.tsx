import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AppIcon } from '@/components/ui/icon';
import { ButtonLink } from '@/components/ui/button';
import { PLAN_LIST, formatPrice, formatLimit } from '@/lib/config/plans';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Four tiers, from a free daily allowance to full API access.',
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-shell px-5 py-16 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-3 font-display text-section-lg font-semibold sm:text-hero">
          Pay for depth, not for picks
        </h1>
        <p className="mt-5 text-lead text-muted">
          Every tier returns the same honest output. What changes is how many fixtures you can
          analyse, how many simulation paths you can run, and how much tooling sits on top.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => (
          <Card
            key={plan.id}
            className={cn('flex flex-col p-6', plan.highlighted && 'border-alpha/45')}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-h2 font-semibold">{plan.name}</h2>
              {plan.highlighted && <Badge variant="premium">Popular</Badge>}
            </div>

            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="tabular font-mono text-data font-medium">
                {formatPrice(plan.priceCents)}
              </span>
              {plan.priceCents > 0 && <span className="text-small text-muted">/month</span>}
            </p>

            <p className="mt-3 min-h-[2.5rem] text-small leading-relaxed text-muted">
              {plan.tagline}
            </p>

            <ButtonLink
              href="/register"
              variant={plan.highlighted ? 'primary' : 'secondary'}
              className="mt-5 w-full"
            >
              {plan.priceCents === 0 ? 'Start free' : `Choose ${plan.name}`}
            </ButtonLink>

            <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-small text-muted">
                  <AppIcon name="check" size={16} className="mt-0.5 h-3.5 w-3.5 text-alpha" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* The allowances that actually differ between tiers, in the same
                order on every card so the four can be read across. */}
            <dl className="mt-6 space-y-1.5 border-t border-line pt-5 font-mono text-fine">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Analyses / day</dt>
                <dd className="tabular">{formatLimit(plan.limits.maxDailyAnalysis)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Paths / run</dt>
                <dd className="tabular">{formatLimit(plan.limits.monteCarloLimit)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">AI queries / day</dt>
                <dd className="tabular">{formatLimit(plan.limits.aiQueriesDaily)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <p className="mt-12 max-w-3xl text-fine leading-relaxed text-muted">
        Prices include applicable VAT where required. Subscriptions renew monthly and can be
        cancelled at any time from the billing portal. SportAlpha AI sells analysis; it does not
        sell selections, tips or any form of guaranteed return.
      </p>
    </div>
  );
}
