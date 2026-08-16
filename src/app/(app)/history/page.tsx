import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/../db';
import { simulationRuns } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { EmptyState, Note } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { getDemoMatch } from '@/lib/demo/matches';
import { pct } from '@/lib/utils';
import type { Outcome1X2 } from '@/lib/types/domain';

export const metadata: Metadata = { title: 'History' };

/** The window the page covers. Stated on the screen, because a total that
    silently means "the last fifty" is a misleading total. */
const LIMIT = 50;

/**
 * Row level security scopes this to the signed-in user, so no explicit
 * user filter is needed. Returns an empty list rather than throwing when
 * the project is unconfigured; the layout redirects to login in that case.
 */
async function loadRuns() {
  const profile = await getProfile();
  if (!profile) return [];
  return db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.userId, profile.id))
    .orderBy(desc(simulationRuns.createdAt))
    .limit(LIMIT);
}

type Run = Awaited<ReturnType<typeof loadRuns>>[number];

/**
 * The stored result is JSON, so nothing about its shape is guaranteed by
 * the type system. Every figure is checked before it is rendered and the
 * row falls back to a dash rather than showing whatever happened to be in
 * the column.
 */
function distributionOf(run: Run): Outcome1X2 | null {
  const results = run.results as Record<string, unknown> | null;
  const home = results?.homeWin;
  const draw = results?.draw;
  const away = results?.awayWin;
  if (typeof home !== 'number' || typeof draw !== 'number' || typeof away !== 'number') {
    return null;
  }
  return { home, draw, away };
}

function homeAdvantageOf(run: Run): number | null {
  const value = (run.inputParameters as Record<string, unknown> | null)?.homeAdvantage;
  return typeof value === 'number' ? value : null;
}

export default async function HistoryPage() {
  const runs = await loadRuns();

  const paths = runs.reduce((sum, run) => sum + run.simulations, 0);
  const fastest = runs.reduce(
    (best, run) => (best === null || run.executionTimeMs < best ? run.executionTimeMs : best),
    null as number | null,
  );

  const columns: Array<Column<Run>> = [
    {
      key: 'fixture',
      header: 'Fixture',
      primary: true,
      cell: (run) => {
        const match = getDemoMatch(run.matchId);
        return (
          <Link
            href={`/matches/${run.matchId}`}
            className="font-medium text-ink transition-colors duration-fast hover:text-alpha"
          >
            {match ? `${match.homeTeam} — ${match.awayTeam}` : run.matchId}
          </Link>
        );
      },
    },
    {
      key: 'outcome',
      header: 'Outcome distribution',
      cell: (run) => {
        const distribution = distributionOf(run);
        if (!distribution) return <span className="text-muted">—</span>;
        return (
          <div className="min-w-[9rem]">
            <ProbabilityBar probabilities={distribution} size="sm" />
            <p className="tabular mt-1.5 font-mono text-fine text-muted">
              {pct(distribution.home, 0)} · {pct(distribution.draw, 0)} · {pct(distribution.away, 0)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'paths',
      header: 'Paths',
      align: 'right',
      numeric: true,
      cell: (run) => run.simulations.toLocaleString('en-US'),
    },
    {
      key: 'scenario',
      header: 'Home adv.',
      align: 'right',
      numeric: true,
      hideOnMobile: true,
      cell: (run) => {
        const value = homeAdvantageOf(run);
        return value === null ? '—' : `+${value.toFixed(2)}`;
      },
    },
    {
      key: 'time',
      header: 'Compute',
      align: 'right',
      numeric: true,
      cell: (run) => (run.executionTimeMs ? `${run.executionTimeMs} ms` : '—'),
    },
    {
      key: 'date',
      header: 'Run at',
      align: 'right',
      numeric: true,
      cell: (run) =>
        run.createdAt.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="History"
        description="Every simulation you have run, with the parameters it used and the distribution it returned."
        actions={
          <ButtonLink href="/monte-carlo" size="sm" variant="secondary" icon="simulation">
            New simulation
          </ButtonLink>
        }
      />

      {runs.length === 0 ? (
        <EmptyState
          icon="history"
          title="Nothing here yet."
          description="Simulations you run are stored automatically, so you can compare how an estimate moved as kickoff approached."
          action={
            <ButtonLink href="/monte-carlo" icon="run">
              Run a simulation
            </ButtonLink>
          }
        />
      ) : (
        <>
          <section
            aria-label="Archive at a glance"
            className="grid grid-cols-2 gap-3 pb-8 xl:grid-cols-3"
          >
            <MetricCard
              label="Runs stored"
              value={String(runs.length)}
              hint={runs.length === LIMIT ? `Most recent ${LIMIT}` : 'All of them'}
              icon="history"
            />
            <MetricCard
              label="Paths simulated"
              value={paths.toLocaleString('en-US')}
              hint="Across these runs"
              icon="simulation"
            />
            <MetricCard
              label="Fastest run"
              value={fastest === null ? '—' : `${fastest} ms`}
              hint="Server compute time"
              icon="live"
              className="col-span-2 xl:col-span-1"
            />
          </section>

          <DataTable
            columns={columns}
            rows={runs}
            rowKey={(run) => run.id}
            caption={`Your ${runs.length} most recent simulation runs`}
          />

          <Note className="mt-6">
            A stored run is a record of what the engine returned for the parameters it was given.
            Re-running the same configuration will move the figures slightly, because the paths are
            resampled each time.
          </Note>
        </>
      )}
    </>
  );
}
