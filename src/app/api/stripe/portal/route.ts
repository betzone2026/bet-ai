import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/../db';
import { subscriptions } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { publicEnv } from '@/lib/env';
import { stripe } from '../client';

/** Opens the Stripe billing portal for the signed-in customer. */
export async function POST() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Log in to manage billing.' }, { status: 401 });
  }

  const [subscription] = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, profile.id))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account yet. Choose a plan first.' }, { status: 400 });
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${publicEnv.siteUrl}/subscription`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: 'The billing portal is unavailable.' }, { status: 502 });
  }
}
