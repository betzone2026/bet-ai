import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { count, desc, eq, ne, sum } from 'drizzle-orm';
import { db } from '@/../db';
import { profiles, simulationRuns, sportsFixtures, subscriptions, usageLogs } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { AdminNav } from '@/components/app/admin-nav';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { ErrorState, EmptyState, Note } from '@/components/ui/states';
import { PLANS } from '@/lib/config/plans';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

interface Metrics {
  users: number;
  activeSubscriptions: number;
  trials: number;
  mrrCents: number;
  monteCarloRuns: number;
  aiQueries: number;
  fixtures: number;
  recent: Array<typeof profiles.$inferSelect>;
}

/**
 * Reads with the service role, which is safe here because the route is
 * already gated twice: middleware checks `is_admin`, and the page checks
 * it again before any query runs.
 */
async function loadMetrics(): Promise<Metrics | null> {
  try {
    const [users, active, trials, runs, byPlan, ai, fixtures, recent] = await Promise.all([
      db.select({ value: count() }).from(profiles),
      db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, 'trialing')),
      db.select({ value: count() }).from(simulationRuns),
      db.select({ plan: profiles.plan }).from(profiles).where(ne(profiles.plan, 'free')),
      db.select({ value: sum(usageLogs.usageCount) }).from(usageLogs).where(eq(usageLogs.feature, 'ai_query')),
      db.select({ value: count() }).from(sportsFixtures),
      db.select().from(profiles).orderBy(desc(profiles.createdAt)).limit(8),
    ]);

    const mrrCents = byPlan.reduce(
      (sum, row) => sum + (PLANS[row.plan]?.priceCents ?? 0),
      0,
    );

    return {
      users: users[0]?.value ?? 0,
      activeSubscriptions: active[0]?.value ?? 0,
      trials: trials[0]?.value ?? 0,
      mrrCents,
      monteCarloRuns: runs[0]?.value ?? 0,
      aiQueries: Number(ai[0]?.value ?? 0),
      fixtures: fixtures[0]?.value ?? 0,
      recent,
    };
  } catch {
    return null;
  }
}

type Profile = typeof profiles.$inferSelect;

const SIGNUP_COLUMNS: Array<Column<Profile>> = [
  {
    key: 'email',
    header: 'Email',
    primary: true,
    cell: (row) => <span className="block truncate font-medium text-ink">{row.email}</span>,
  },
  {
    key: 'plan',
    header: 'Plan',
    cell: (row) => (
      <Badge variant={row.plan === 'free' ? 'neutral' : 'premium'}>{row.plan}</Badge>
    ),
  },
  {
    key: 'status',
    header: 'Billing',
    hideOnMobile: true,
    cell: (row) => (
      <Badge variant={row.subscriptionStatus === 'active' ? 'success' : 'neutral'}>
        {row.subscriptionStatus.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    key: 'joined',
    header: 'Joined',
    align: 'right',
    numeric: true,
    cell: (row) => row.createdAt.toLocaleDateString('en-GB'),
  },
];

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile?.is_admin) redirect('/dashboard');

  const metrics = await loadMetrics();

  return (
    <>
      <PageHeader
        eyebrow="Internal console"
        title="Overview"
        description="Live counts read straight from the database. Nothing here is cached or estimated."
      />

      <AdminNav />

      {!metrics ? (
        <ErrorState
          title="Metrics unavailable"
          description="The database did not answer, so no count on this screen can be trusted. Check the site database connection and reload."
          detail="Query batch against profiles, subscriptions, simulation_runs, usage_logs and sports_fixtures threw. Most often an unset or expired NETLIFY_DATABASE_URL."
          showDetail
        />
      ) : (
        <>
          <section aria-label="Account and revenue" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="MRR"
              value={`€${(metrics.mrrCents / 100).toFixed(2)}`}
              hint="Sum of active paid plans"
              icon="subscription"
              accent
            />
            <MetricCard
              label="Users"
              value={metrics.users.toLocaleString('en-US')}
              hint="Profiles on record"
              icon="users"
            />
            <MetricCard
              label="Active subscriptions"
              value={metrics.activeSubscriptions.toLocaleString('en-US')}
              hint="Status active"
              icon="check"
            />
            <MetricCard
              label="Trials"
              value={metrics.trials.toLocaleString('en-US')}
              hint="Status trialing"
              icon="history"
            />
          </section>

          <section aria-label="Engine usage" className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="AI queries"
              value={metrics.aiQueries.toLocaleString('en-US')}
              hint="All time"
              icon="analyst"
            />
            <MetricCard
              label="Monte Carlo runs"
              value={metrics.monteCarloRuns.toLocaleString('en-US')}
              hint="Stored runs"
              icon="simulation"
            />
            <MetricCard
              label="Fixtures imported"
              value={metrics.fixtures.toLocaleString('en-US')}
              hint={metrics.fixtures === 0 ? 'Demo dataset in use' : 'Stored from the provider'}
              icon="sportsData"
            />
            <MetricCard
              label="Churn"
              value="—"
              hint="Needs 30 days of billing history"
              icon="down"
            />
          </section>

          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-h2 font-semibold">Recent sign-ups</h2>
              <span className="font-mono text-fine text-muted">Last {metrics.recent.length}</span>
            </div>
            <DataTable
              columns={SIGNUP_COLUMNS}
              rows={metrics.recent}
              rowKey={(row) => row.id}
              caption="The eight most recently created profiles"
              empty={
                <EmptyState
                  icon="users"
                  title="No profiles yet."
                  description="Accounts appear here as soon as the first user completes sign-up."
                />
              }
            />
          </section>

          <Note className="mt-6">
            Every figure above is a count over the whole table at the moment the page rendered.
            Revenue is the sum of list prices for non-free plans, not billed revenue — discounts,
            proration and failed payments are not reflected until billing history is wired in.
          </Note>
        </>
      )}
    </>
  );
}
