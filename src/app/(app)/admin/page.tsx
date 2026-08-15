import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { count, desc, eq, ne, sum } from 'drizzle-orm';
import { db } from '@/../db';
import { profiles, simulationRuns, sportsFixtures, subscriptions, usageLogs } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { Stat } from '@/components/ui/stat';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS } from '@/lib/config/plans';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

/** Sections of the internal console. Those already built link out. */
const SECTIONS: Array<{ label: string; href?: string }> = [
  { label: 'Users' },
  { label: 'Subscriptions' },
  { label: 'Sports data', href: '/admin/sports' },
  { label: 'Leagues' },
  { label: 'Matches' },
  { label: 'Models' },
  { label: 'Monte Carlo' },
  { label: 'API usage', href: '/admin/sports' },
  { label: 'System logs' },
  { label: 'Settings' },
];

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

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile?.is_admin) redirect('/dashboard');

  const metrics = await loadMetrics();

  return (
    <>
      <PageHeader
        eyebrow="Internal"
        title="Admin"
        description="Live counts read straight from the database."
      />

      {!metrics ? (
        <div className="rounded-xl border border-down/30 bg-down/[0.06] px-5 py-6">
          <p className="eyebrow text-down">Error</p>
          <h2 className="mt-1 font-display text-base font-semibold">Metrics unavailable</h2>
          <p className="mt-1 text-sm text-muted">
            Netlify Database is unavailable. Check the site database connection and reload.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="MRR" value={`€${(metrics.mrrCents / 100).toFixed(2)}`} accent hint="Sum of active paid plans" />
            <Stat label="Users" value={metrics.users.toLocaleString('en-US')} />
            <Stat label="Active subscriptions" value={metrics.activeSubscriptions.toLocaleString('en-US')} />
            <Stat label="Trials" value={metrics.trials.toLocaleString('en-US')} />
            <Stat label="AI queries" value={metrics.aiQueries.toLocaleString('en-US')} hint="All time" />
            <Stat label="Monte Carlo runs" value={metrics.monteCarloRuns.toLocaleString('en-US')} />
            <Stat
              label="Fixtures imported"
              value={metrics.fixtures.toLocaleString('en-US')}
              hint={metrics.fixtures === 0 ? 'Demo dataset in use' : 'Stored from the provider'}
            />
            <Stat label="Churn" value="—" hint="Needs 30 days of billing history" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Recent sign-ups</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-line">
                    <tr>
                      <th className="eyebrow px-4 py-2.5 text-left font-normal">Email</th>
                      <th className="eyebrow px-4 py-2.5 text-left font-normal">Plan</th>
                      <th className="eyebrow px-4 py-2.5 text-right font-normal">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {metrics.recent.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-[18ch] truncate px-4 py-2.5">{row.email}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-alpha">{row.plan}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                          {row.createdAt.toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sections</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="grid grid-cols-2 gap-2">
                  {SECTIONS.map((section) =>
                    section.href ? (
                      <li key={section.label}>
                        <Link
                          href={section.href}
                          className="block rounded-lg border border-alpha/35 bg-alpha/[0.06] px-3 py-2 text-xs text-alpha hover:border-alpha/60"
                        >
                          {section.label}
                        </Link>
                      </li>
                    ) : (
                      <li
                        key={section.label}
                        className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted"
                      >
                        {section.label}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  Sports data is live; the remaining sections get their own table view as the
                  features behind them are built.
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
