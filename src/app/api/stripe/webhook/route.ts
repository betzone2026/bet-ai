import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/../db';
import { profiles, subscriptions } from '@/../db/schema';
import { serverEnv } from '@/lib/env';
import { PLAN_IDS, type PlanId } from '@/lib/config/plans';
import { stripe } from '../client';

export const runtime = 'nodejs';

/**
 * Stripe is the source of truth for entitlement. This handler is the only
 * place `profiles.plan` is written, and it runs with the service role
 * because the caller is Stripe, not a signed-in user.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.user_id ?? session.client_reference_id;
      if (userId && typeof session.subscription === 'string') {
        const subscription = await stripe().subscriptions.retrieve(session.subscription);
        await persist(userId, subscription);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      if (userId) await persist(userId, subscription);
      break;
    }

    default:
      // Everything else is acknowledged and ignored on purpose.
      break;
  }

  return NextResponse.json({ received: true });
}

function planFromSubscription(subscription: Stripe.Subscription): PlanId {
  const candidate = subscription.metadata?.plan;
  return PLAN_IDS.includes(candidate as PlanId) ? (candidate as PlanId) : 'free';
}

async function persist(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const active = subscription.status === 'active' || subscription.status === 'trialing';
  const plan = active ? planFromSubscription(subscription) : 'free';
  const status = normaliseStatus(subscription.status);
  await db
    .insert(subscriptions)
    .values({
      id: subscription.id,
      userId,
      stripeCustomerId: String(subscription.customer),
      stripePriceId: subscription.items.data[0]?.price.id ?? null,
      plan: planFromSubscription(subscription),
      status,
      currentPeriodStart: toDate(subscription.current_period_start),
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        stripeCustomerId: String(subscription.customer),
        stripePriceId: subscription.items.data[0]?.price.id ?? null,
        plan: planFromSubscription(subscription),
        status,
        currentPeriodStart: toDate(subscription.current_period_start),
        currentPeriodEnd: toDate(subscription.current_period_end),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });

  await db
    .update(profiles)
    .set({ plan, subscriptionStatus: status, updatedAt: new Date() })
    .where(eq(profiles.id, userId));
}

function toDate(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}

function normaliseStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'canceled' || status === 'incomplete') {
    return status;
  }
  return 'inactive' as const;
}
