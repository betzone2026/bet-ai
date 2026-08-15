import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { FixtureCard } from '@/components/app/fixture-card';
import { MatchCard } from '@/components/app/match-card';
import { Stat } from '@/components/ui/stat';
import { DemoBadge, LiveDataBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { getPlan, formatLimit } from '@/lib/config/plans';
import { DEMO_REASON_COPY, getFixtureFeed } from '@/lib/sports/data-source';
import { pct } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);
  const firstName = profile?.full_name?.split(' ')[0];

  // Today, in UTC — the same window the sync service imports.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

  const feed = await getFixtureFeed({ from: startOfDay, to: endOfDay, limit: 60 });

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        description={
          feed.mode === 'REAL'
            ? "Today's fixtures, as imported from the data provider."
            : "Today's fixtures with their current model output."
        }
        actions={feed.mode === 'REAL' ? <LiveDataBadge /> : <DemoBadge />}
      />

      {feed.mode === 'REAL' ? (
        <RealDashboard feed={feed} monteCarloLimit={formatLimit(plan.limits.monteCarloRunsDaily)} planName={plan.name} />
      ) : (
        <DemoDashboard feed={feed} monteCarloLimit={formatLimit(plan.limits.monteCarloRunsDaily)} planName={plan.name} />
      )}
    </>
  );
}

function RealDashboard({
  feed,
  monteCarloLimit,
  planName,
}: {
  feed: Extract<Awaited<ReturnType<typeof getFixtureFeed>>, { mode: 'REAL' }>;
  monteCarloLimit: string;
  planName: string;
}) {
  const fixtures = feed.fixtures;
  const finished = fixtures.filter((fixture) => fixture.status === 'finished').length;
  const live = fixtures.filter((fixture) => fixture.status === 'live').length;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's fixtures" value={String(fixtures.length)} hint="Imported for today" />
        <Stat label="In play" value={String(live)} hint="Currently under way" accent />
        <Stat label="Completed" value={String(finished)} hint="Final score stored" />
        <Stat
          label="Monte Carlo runs"
          value="0"
          hint={`${monteCarloLimit} per day on ${planName}`}
        />
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between pb-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Today&apos;s fixtures</h2>
          <Link href="/matches" className="text-sm text-muted hover:text-ink">
            All matches
          </Link>
        </div>

        {fixtures.length === 0 ? (
          <EmptyState
            title="No fixtures today"
            description="None of the covered competitions play today. The next fortnight is on the matches page."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 rounded-xl border border-line bg-surface/50 px-4 py-3 text-xs leading-relaxed text-muted">
        Fixtures on this page are real and stored as reported. They carry no model output yet —
        probabilities appear once the quantitative engine is connected.
      </p>
    </>
  );
}

function DemoDashboard({
  feed,
  monteCarloLimit,
  planName,
}: {
  feed: Extract<Awaited<ReturnType<typeof getFixtureFeed>>, { mode: 'DEMO' }>;
  monteCarloLimit: string;
  planName: string;
}) {
  const matches = feed.matches;

  const averageConfidence =
    matches.reduce((sum, m) => sum + m.confidence, 0) / Math.max(matches.length, 1);

  // A "signal" here means the model and the market disagree enough to be
  // worth a look. It is not a recommendation to act.
  const signals = matches.filter((m) => m.confidence >= 0.7 && m.risk <= 0.45).length;

  return (
    <>
      <p className="mb-6 rounded-lg border border-alpha/25 bg-alpha/[0.06] px-4 py-3 text-sm text-muted">
        {DEMO_REASON_COPY[feed.reason]}
      </p>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's matches" value={String(matches.length)} hint="In the demo catalogue" />
        <Stat label="Value signals" value={String(signals)} hint="High confidence, low dispersion" accent />
        <Stat label="Average confidence" value={pct(averageConfidence, 0)} hint="Across today's slate" />
        <Stat
          label="Monte Carlo runs"
          value="0"
          hint={`${monteCarloLimit} per day on ${planName}`}
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
