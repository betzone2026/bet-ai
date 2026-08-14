import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { getPlan } from '@/lib/config/plans';

export const metadata: Metadata = { title: 'Portfolio' };

export default async function PortfolioPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);

  if (!plan.limits.portfolioTools) {
    return (
      <>
        <PageHeader eyebrow="Risk" title="Portfolio" />
        <EmptyState
          title="Portfolio tools are on Advanced and Quant"
          description="Track exposure across positions, decompose risk by fixture and league, and see how correlated your open positions really are."
          action={<ButtonLink href="/subscription">Compare plans</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Risk"
        title="Portfolio"
        description="Exposure and risk across the positions you are tracking."
      />
      <EmptyState
        title="No positions tracked yet"
        description="Add a fixture from the match analyser to start building a position book. Exposure, correlation and risk decomposition appear here once there is something to measure."
        action={<ButtonLink href="/matches">Browse matches</ButtonLink>}
      />
    </>
  );
}
