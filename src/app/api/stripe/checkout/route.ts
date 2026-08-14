import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { getPlan, PLAN_IDS, type PlanId } from '@/lib/config/plans';
import { stripe } from '../client';

/** Creates a Checkout session for the requested plan. Test mode by default. */
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Log in to change your plan.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: string } | null;
  const planId = body?.plan as PlanId | undefined;

  if (!planId || !PLAN_IDS.includes(planId) || planId === 'free') {
    return NextResponse.json({ error: 'Choose a paid plan.' }, { status: 400 });
  }

  const plan = getPlan(planId);
  if (!plan.stripePriceEnvKey) {
    return NextResponse.json({ error: 'That plan is not purchasable.' }, { status: 400 });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: serverEnv.priceIdFor(plan.stripePriceEnvKey), quantity: 1 }],
      customer_email: profile.email,
      client_reference_id: profile.id,
      metadata: { user_id: profile.id, plan: planId },
      subscription_data: { metadata: { user_id: profile.id, plan: planId } },
      success_url: `${publicEnv.siteUrl}/subscription?checkout=success`,
      cancel_url: `${publicEnv.siteUrl}/subscription?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: 'Checkout could not be started.' }, { status: 502 });
  }
}
