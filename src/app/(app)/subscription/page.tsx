import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { PlanPicker } from './plan-picker';
import { getPlan } from '@/lib/config/plans';

export const metadata: Metadata = { title: 'Subscription' };

export default async function SubscriptionPage() {
  const profile = await getProfile();
  const current = getPlan(profile?.plan);

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description={`You are on ${current.name}. Changing plan takes effect immediately.`}
      />
      <PlanPicker currentPlan={current.id} status={profile?.subscription_status ?? 'inactive'} />
    </>
  );
}
