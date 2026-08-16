'use client';

import { useState } from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppIcon } from '@/components/ui/icon';
import { Note } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { PLAN_LIST, formatPrice, formatLimit, type PlanId } from '@/lib/config/plans';
import type { SubscriptionState } from '@/lib/types/database';
import { cn } from '@/lib/utils';

/** Status words are provider vocabulary, so each one is given a colour and
    a plain-English gloss rather than being printed raw. */
const STATUS_COPY: Record<string, { variant: 'success' | 'warning' | 'danger' | 'neutral'; note: string }> = {
  active: { variant: 'success', note: 'Billing is current.' },
  trialing: { variant: 'success', note: 'A trial is running on this account.' },
  past_due: { variant: 'warning', note: 'The last payment did not clear.' },
  canceled: { variant: 'danger', note: 'The subscription ends at the close of the paid period.' },
  inactive: { variant: 'neutral', note: 'No paid subscription is attached to this account.' },
};

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

  const statusCopy = STATUS_COPY[status] ?? STATUS_COPY.inactive!;

  return (
    <>
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="eyebrow">Billing status</span>
            <Badge variant={statusCopy.variant}>{status.replace('_', ' ')}</Badge>
            <span className="text-small text-muted">{statusCopy.note}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="subscription"
            onClick={manage}
            disabled={pending !== null}
          >
            Manage billing
          </Button>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_LIST.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card
              key={plan.id}
              className={cn('flex flex-col', isCurrent && 'border-alpha/50')}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                {isCurrent ? (
                  <Badge variant="premium">Current</Badge>
                ) : plan.highlighted ? (
                  <Badge variant="info">Most chosen</Badge>
                ) : null}
              </CardHeader>

              <CardBody className="flex flex-1 flex-col">
                <p className="tabular font-mono text-h1 leading-none">
                  {formatPrice(plan.priceCents)}
                  {plan.priceCents > 0 && (
                    <span className="ml-1 font-sans text-small text-muted">/month</span>
                  )}
                </p>
                <p className="mt-2 text-small leading-relaxed text-muted">{plan.tagline}</p>

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-small text-muted">
                      <AppIcon
                        name="check"
                        size={16}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-alpha"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <p className="tabular mt-4 border-t border-line pt-3 font-mono text-fine text-muted">
                  {formatLimit(plan.limits.monteCarloLimit)} paths ·{' '}
                  {formatLimit(plan.limits.maxDailyAnalysis)} analyses/day
                </p>
              </CardBody>

              <CardFooter className="p-3">
                <Button
                  className="w-full"
                  variant={isCurrent ? 'secondary' : plan.highlighted ? 'primary' : 'secondary'}
                  disabled={isCurrent || plan.id === 'free' || pending !== null}
                  loading={pending === plan.id}
                  onClick={() => choose(plan.id)}
                >
                  {isCurrent ? 'Current plan' : plan.id === 'free' ? 'Included' : `Switch to ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Note className="mt-6">
        Payments are handled by Stripe in test mode until live keys are configured. No card details
        are stored by SportAlpha AI.
      </Note>
    </>
  );
}
