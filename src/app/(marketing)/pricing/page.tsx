import type { Metadata } from 'next';
import { Check } from 'lucide-react';
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
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Pay for depth, not for picks
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted">
          Every tier returns the same honest output. What changes is how many fixtures you can
          analyse, how many simulation paths you can run, and how much tooling sits on top.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'flex flex-col rounded-2xl border bg-surface p-6 hairline-top',
              plan.highlighted ? 'border-alpha/45' : 'border-line',
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
              {plan.highlighted && (
                <span className="rounded-md bg-alpha/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-alpha">
                  Popular
                </span>
              )}
            </div>

            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="tabular font-mono text-3xl font-medium">{formatPrice(plan.priceCents)}</span>
              {plan.priceCents > 0 && <span className="text-sm text-muted">/month</span>}
            </p>

            <p className="mt-3 min-h-[2.5rem] text-sm leading-relaxed text-muted">{plan.tagline}</p>

            <ButtonLink
              href="/register"
              variant={plan.highlighted ? 'primary' : 'secondary'}
              className="mt-5 w-full"
            >
              {plan.priceCents === 0 ? 'Start free' : `Choose ${plan.name}`}
            </ButtonLink>

            <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-alpha" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-6 space-y-1.5 border-t border-line pt-5 font-mono text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">Analyses / day</dt>
                <dd className="tabular">{formatLimit(plan.limits.maxDailyAnalysis)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Paths / run</dt>
                <dd className="tabular">{formatLimit(plan.limits.monteCarloLimit)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">AI queries / day</dt>
                <dd className="tabular">{formatLimit(plan.limits.aiQueriesDaily)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-12 max-w-3xl text-xs leading-relaxed text-muted">
        Prices include applicable VAT where required. Subscriptions renew monthly and can be
        cancelled at any time from the billing portal. SportAlpha AI sells analysis; it does not
        sell selections, tips or any form of guaranteed return.
      </p>
    </div>
  );
}
