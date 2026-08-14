'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PLAN_LIST, formatPrice, formatLimit, type PlanId } from '@/lib/config/plans';
import type { SubscriptionState } from '@/lib/types/database';
import { cn } from '@/lib/utils';

export function PlanPicker({
  currentPlan,
  status,
}: {
  currentPlan: PlanId;
  status: SubscriptionState;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<PlanId | null>(null);

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      throw new Error(data.error ?? 'Something went wrong.');
    }
    window.location.assign(data.url);
  }

  async function choose(plan: PlanId) {
    setPending(plan);
    try {
      await post('/api/stripe/checkout', { plan });
    } catch (caught) {
      toast.show(caught instanceof Error ? caught.message : 'Checkout failed.', 'error');
      setPending(null);
    }
  }

  async function manage() {
    setPending(currentPlan);
    try {
      await post('/api/stripe/portal');
    } catch (caught) {
      toast.show(caught instanceof Error ? caught.message : 'Portal unavailable.', 'error');
      setPending(null);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="text-sm">
          <span className="text-muted">Status: </span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-alpha">{status}</span>
        </p>
        <Button variant="secondary" size="sm" onClick={manage} disabled={pending !== null}>
          Manage billing
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col rounded-xl border bg-surface p-5 hairline-top',
                isCurrent ? 'border-alpha/50' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">{plan.name}</h2>
                {isCurrent && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-alpha">
                    Current
                  </span>
                )}
              </div>

              <p className="tabular mt-3 font-mono text-2xl">{formatPrice(plan.priceCents)}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-xs text-muted">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-alpha" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              <p className="tabular mt-4 border-t border-line pt-3 font-mono text-[11px] text-muted">
                {formatLimit(plan.limits.monteCarloLimit)} paths ·{' '}
                {formatLimit(plan.limits.maxDailyAnalysis)} analyses/day
              </p>

              <Button
                className="mt-4 w-full"
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent || plan.id === 'free' || pending !== null}
                onClick={() => choose(plan.id)}
              >
                {isCurrent ? 'Current plan' : pending === plan.id ? 'Opening…' : `Switch to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Payments are handled by Stripe in test mode until live keys are configured. No card details
        are stored by SportAlpha AI.
      </p>
    </>
  );
}
