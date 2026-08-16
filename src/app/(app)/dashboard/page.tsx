import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { FixtureCard } from '@/components/app/fixture-card';
import { MatchCard } from '@/components/app/match-card';
import { MetricCard } from '@/components/ui/metric-card';
import { AppIcon } from '@/components/ui/icon';
import { DemoBadge, LiveDataBadge } from '@/components/ui/badge';
import { EmptyState, Note } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { getPlan, formatLimit } from '@/lib/config/plans';
import { DEMO_REASON_COPY, getFixtureFeed } from '@/lib/sports/data-source';
import { pct } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/** Server clocks run in UTC, which is within an hour or two of the
    audience this product serves — close enough for a greeting, and it
    avoids a heading that rewrites itself after hydration. */
function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const profile = await getProfile();
  const plan = getPlan(profile?.plan);
  const firstName = profile?.full_name?.split(' ')[0];
  const now = new Date();

  // Today, in UTC — the same window the sync service imports.
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

  const feed = await getFixtureFeed({ from: startOfDay, to: endOfDay, limit: 60 });
  const runsHint = `of ${formatLimit(plan.limits.monteCarloRunsDaily)} per day on ${plan.name}`;

  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={firstName ? `${greeting(now.getUTCHours())}, ${firstName}` : greeting(now.getUTCHours())}
        description={
          feed.mode === 'REAL'
            ? 'Live market intelligence for today.'
            : 'Sample market intelligence, until the first sync completes.'
        }
        actions={feed.mode === 'REAL' ? <LiveDataBadge /> : <DemoBadge />}
      />

      {feed.mode === 'DEMO' && (
        <Note tone="warning" className="mb-6">
          {DEMO_REASON_COPY[feed.reason]}
        </Note>
      )}

      {feed.mode === 'REAL' ? (
        <RealDashboard feed={feed} runsHint={runsHint} />
      ) : (
        <DemoDashboard feed={feed} runsHint={runsHint} />
      )}
    </>
  );
}

/** One heading treatment for both variants of the fixture section. */
function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-4 pb-4">
      <h2 className="font-display text-h2 font-semibold">
        {title}
        <span className="tabular ml-2 font-mono text-body font-normal text-muted">{count}</span>
      </h2>
      <Link
        href="/matches"
        className="inline-flex min-h-touch items-center gap-1.5 text-small text-muted transition-colors duration-fast hover:text-ink sm:min-h-0"
      >
        All matches
        <AppIcon name="forward" size={16} />
      </Link>
    </div>
  );
}

function RealDashboard({
  feed,
  runsHint,
}: {
  feed: Extract<Awaited<ReturnType<typeof getFixtureFeed>>, { mode: 'REAL' }>;
  runsHint: string;
}) {
  const fixtures = feed.fixtures;
  const finished = fixtures.filter((fixture) => fixture.status === 'finished').length;
  const live = fixtures.filter((fixture) => fixture.status === 'live').length;

  return (
    <>
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Fixtures"
          value={String(fixtures.length)}
          hint="Imported for today"
          icon="matches"
        />
        <MetricCard
          label="In play"
          value={String(live)}
          hint="Currently under way"
          icon="live"
          accent={live > 0}
        />
        <MetricCard
          label="Completed"
          value={String(finished)}
          hint="Final score stored"
          icon="check"
        />
        <MetricCard label="Monte Carlo runs" value="0" hint={runsHint} icon="simulation" />
      </section>

      <section className="mt-10">
        <SectionHeading title="Today’s fixtures" count={fixtures.length} />

        {fixtures.length === 0 ? (
          <EmptyState
            icon="matches"
            title="No fixtures found."
            description="None of the covered competitions play today. The next fortnight is on the matches page."
            action={
              <ButtonLink href="/matches" variant="secondary" size="sm" icon="matches">
                Choose another date
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        )}
      </section>

      <Note className="mt-8">
        Fixtures on this page are real and stored as reported. They carry no model output yet —
        probabilities appear once the quantitative engine is connected.
      </Note>
    </>
  );
}

function DemoDashboard({
  feed,
  runsHint,
}: {
  feed: Extract<Awaited<ReturnType<typeof getFixtureFeed>>, { mode: 'DEMO' }>;
  runsHint: string;
}) {
  const matches = feed.matches;

  const averageConfidence =
    matches.reduce((sum, match) => sum + match.confidence, 0) / Math.max(matches.length, 1);

  // A "signal" here means the model is confident and the simulated
  // outcomes are tightly clustered. It is not a recommendation to act.
  const signals = matches.filter((match) => match.confidence >= 0.7 && match.risk <= 0.45).length;

  return (
    <>
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Fixtures"
          value={String(matches.length)}
          hint="In the sample catalogue"
          icon="matches"
        />
        <MetricCard
          label="Value signals"
          value={String(signals)}
          hint="High confidence, low dispersion"
          icon="up"
          accent={signals > 0}
        />
        <MetricCard
          label="Average confidence"
          value={pct(averageConfidence, 0)}
          hint="Across today’s slate"
          icon="gauge"
        />
        <MetricCard label="Monte Carlo runs" value="0" hint={runsHint} icon="simulation" />
      </section>

      <section className="mt-10">
        <SectionHeading title="Today’s analysis" count={matches.length} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>

      <Note tone="warning" className="mt-8">
        Figures on this page come from a sample dataset used to build the interface. Live fixtures
        and model output arrive when the sports-data feed and quantitative engine are connected.
      </Note>
    </>
  );
}
