import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { MatchCard } from '@/components/app/match-card';
import { Stat } from '@/components/ui/stat';
import { DemoBadge } from '@/components/ui/badge';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { getPlan, formatLimit } from '@/lib/config/plans';
import { pct } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);
  const matches = DEMO_MATCHES;

  const averageConfidence =
    matches.reduce((sum, m) => sum + m.confidence, 0) / Math.max(matches.length, 1);

  // A "signal" here means the model and the market disagree enough to be
  // worth a look. It is not a recommendation to act.
  const signals = matches.filter((m) => m.confidence >= 0.7 && m.risk <= 0.45).length;

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description="Today's fixtures with their current model output."
        actions={<DemoBadge />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's matches" value={String(matches.length)} hint="In the demo catalogue" />
        <Stat label="Value signals" value={String(signals)} hint="High confidence, low dispersion" accent />
        <Stat label="Average confidence" value={pct(averageConfidence, 0)} hint="Across today's slate" />
        <Stat
          label="Monte Carlo runs"
          value="0"
          hint={`${formatLimit(plan.limits.monteCarloRunsDaily)} per day on ${plan.name}`}
        />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between pb-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Today&apos;s analysis</h2>
          <Link href="/matches" className="text-sm text-muted hover:text-ink">
            All matches
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>

      <p className="mt-8 rounded-xl border border-alpha/25 bg-alpha/[0.05] px-4 py-3 text-xs leading-relaxed text-muted">
        Figures on this page come from a sample dataset used to build the interface. Live fixtures
        and model output arrive when the sports-data feed and quantitative engine are connected.
      </p>
    </>
  );
}
