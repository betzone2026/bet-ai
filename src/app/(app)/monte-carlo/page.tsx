import type { Metadata } from 'next';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { MonteCarloConsole } from './console';

export const metadata: Metadata = { title: 'Monte Carlo' };

export default async function MonteCarloPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const [profile, query] = await Promise.all([getProfile(), searchParams]);

  return (
    <>
      <PageHeader
        eyebrow="Monte Carlo"
        title="Simulation Lab"
        description="Play a fixture out thousands of times and read the distribution that comes back. Nothing is stored against the fixture — a run is yours, configured here."
      />
      <MonteCarloConsole plan={profile?.plan ?? 'free'} initialMatchId={query.match} />
    </>
  );
}
