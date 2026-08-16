import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { AdminNav } from '@/components/app/admin-nav';
import { Badge, DataQualityBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { AppIcon } from '@/components/ui/icon';
import { Note } from '@/components/ui/states';
import { getProfile } from '@/lib/auth/server';
import { CACHE_TTL_SECONDS, SUPPORTED_LEAGUES, SUPPORTED_LEAGUE_KEYS } from '@/lib/sports/config';
import { coverageVerdict } from '@/lib/sports/coverage';
import { todayIso } from '@/lib/sports/dates';
import { getSportsDataStatus } from '@/lib/sports/status';
import type { SyncRunRow } from '@/lib/sports/sync/runs';
import { CoveragePanel, type CoverageRowView } from './coverage-panel';
import { QuotaMeter } from './quota-meter';
import { SyncPanel } from './sync-panel';

export const metadata: Metadata = { title: 'Sports data' };
export const dynamic = 'force-dynamic';

function when(value: Date | null): string {
  if (!value) return 'never';
  return value.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Renders a counter the provider may not have sent.
 *
 * `—` means the provider did not say, which is deliberately different from `0`.
 * Showing an unknown allowance as zero would read as "quota spent" on a key
 * that has never been used.
 */
function counter(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US');
}

const RUN_COLUMNS: Array<Column<SyncRunRow>> = [
  {
    key: 'started',
    header: 'Started',
    primary: true,
    cell: (run) => (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-fine text-muted">{when(run.startedAt)}</span>
        <span className="font-mono text-small text-ink">{run.syncType}</span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (run) => (
      <Badge
        variant={
          run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : 'neutral'
        }
      >
        {run.status}
      </Badge>
    ),
  },
  {
    key: 'returned',
    header: 'Returned',
    align: 'right',
    numeric: true,
    hideOnMobile: true,
    cell: (run) => run.providerReturned,
  },
  {
    key: 'matched',
    header: 'Matched',
    align: 'right',
    numeric: true,
    cell: (run) => run.recordsMatched,
  },
  {
    key: 'inserted',
    header: 'New',
    align: 'right',
    numeric: true,
    cell: (run) => run.recordsInserted,
  },
  {
    key: 'updated',
    header: 'Updated',
    align: 'right',
    numeric: true,
    hideOnMobile: true,
    cell: (run) => run.recordsUpdated,
  },
  {
    key: 'failed',
    header: 'Failed',
    align: 'right',
    numeric: true,
    cell: (run) => (
      <span className={run.recordsFailed > 0 ? 'text-down' : 'text-muted'}>{run.recordsFailed}</span>
    ),
  },
  {
    key: 'requests',
    header: 'Requests',
    align: 'right',
    numeric: true,
    hideOnMobile: true,
    cell: (run) => run.apiRequests,
  },
];

export default async function AdminSportsPage() {
  const profile = await getProfile();
  if (!profile?.is_admin) redirect('/dashboard');

  const status = await getSportsDataStatus();
  const { quota } = status;

  const syncDisabledReason = !status.apiConfigured
    ? 'No provider key is configured.'
    : status.quotaState === 'EXHAUSTED'
      ? 'The daily request allowance is spent. It resets at 00:00 UTC.'
      : undefined;

  // Dates and verdicts are resolved here so the client component receives plain
  // values and renders identically on both passes.
  const coverageRows: CoverageRowView[] = status.coverage.map((row) => ({
    leagueKey: row.leagueKey,
    name: row.name,
    country: row.country,
    providerLeagueId: row.providerLeagueId,
    currentSeason: row.currentSeason,
    latestSeason: row.latestSeason,
    seasonYears: row.seasons.map((season) => season.year).sort((a, b) => b - a),
    fixturesAvailable: row.fixturesAvailable,
    error: row.error,
    checkedAt: row.checkedAt ? when(row.checkedAt) : null,
    verdict: coverageVerdict(row),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Internal console"
        title="Sports data"
        description="State of the ingestion pipeline: what is configured, what was imported, and what it cost."
      />

      <AdminNav />

      {!status.apiConfigured && (
        <Card variant="warning" className="mb-4">
          <CardBody className="flex gap-3">
            <AppIcon name="alert" size={18} className="mt-0.5 shrink-0 text-alpha" />
            <div>
              <h2 className="font-display text-h3 font-semibold">No provider key is set</h2>
              <p className="mt-1 text-small leading-relaxed text-muted">
                Set <code className="font-mono text-fine text-ink">API_FOOTBALL_KEY</code> under
                Site configuration → Environment variables to enable imports. The application keeps
                running on the demo dataset until it is present; no request is attempted without it.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {status.apiConfigured && status.quotaState === 'EXHAUSTED' && (
        <Card variant="danger" className="mb-4">
          <CardBody className="flex gap-3">
            <AppIcon name="alert" size={18} className="mt-0.5 shrink-0 text-down" />
            <div>
              <h2 className="font-display text-h3 font-semibold">No requests left today</h2>
              <p className="mt-1 text-small leading-relaxed text-muted">
                The provider reports 0 of {counter(quota.dailyLimit)} daily requests remaining. Sync
                is disabled until the allowance resets at 00:00 UTC; stored fixtures continue to be
                served.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {status.apiConfigured && status.quotaState === 'LOW' && (
        <Card variant="warning" className="mb-4">
          <CardBody className="flex gap-3">
            <AppIcon name="alert" size={18} className="mt-0.5 shrink-0 text-alpha" />
            <div>
              <h2 className="font-display text-h3 font-semibold">
                {counter(quota.dailyRemaining)} of {counter(quota.dailyLimit)} daily requests left
              </h2>
              <p className="mt-1 text-small leading-relaxed text-muted">
                A fixtures sync costs one request. Detail syncs — standings, statistics, lineups,
                injuries, odds — are charged per fixture, so run them sparingly until the reset.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <section aria-label="Provider" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Provider"
          value={status.provider}
          hint="Server-side only"
          icon="sportsData"
        />
        <MetricCard
          label="API status"
          value={status.apiConfigured ? 'Configured' : 'Absent'}
          accent={status.apiConfigured}
          hint={status.apiConfigured ? 'Key present in the environment' : 'Serving demo data'}
          icon="shield"
        />
        <MetricCard
          label="Daily requests"
          value={status.requestsToday.toLocaleString('en-US')}
          hint="Counted per endpoint"
          icon="apiUsage"
        />
        <MetricCard
          label="Daily remaining"
          value={counter(quota.dailyRemaining)}
          accent={status.quotaState === 'OK'}
          hint={
            status.quotaState === 'UNKNOWN'
              ? 'Not yet reported by the provider'
              : `of ${counter(quota.dailyLimit)} · read ${when(quota.observedAt)}`
          }
          icon="gauge"
        />
      </section>

      <section aria-label="Stored records" className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Fixtures"
          value={status.counts.fixtures.toLocaleString('en-US')}
          hint={status.hasRealData ? 'Served from the database' : 'Demo dataset in use'}
          icon="matches"
        />
        <MetricCard
          label="Teams"
          value={status.counts.teams.toLocaleString('en-US')}
          hint="Deduplicated by provider id"
          icon="users"
        />
        <MetricCard
          label="Leagues"
          value={status.counts.leagues.toLocaleString('en-US')}
          hint={`${SUPPORTED_LEAGUE_KEYS.length} configured`}
          icon="leagues"
        />
        <MetricCard
          label="Odds snapshots"
          value={status.counts.oddsSnapshots.toLocaleString('en-US')}
          hint="Append-only price history"
          icon="wallet"
        />
      </section>

      {/* ---- Sync control ------------------------------------------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Sync control</CardTitle>
            <CardDescription>The only two actions that reach the provider</CardDescription>
          </CardHeader>
          <CardBody>
            <SyncPanel
              disabled={!status.canSync}
              today={todayIso()}
              leagues={SUPPORTED_LEAGUE_KEYS}
              {...(syncDisabledReason ? { disabledReason: syncDisabledReason } : {})}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle id="quota">Request quota</CardTitle>
              <Badge
                variant={
                  status.quotaState === 'OK'
                    ? 'success'
                    : status.quotaState === 'LOW'
                      ? 'warning'
                      : status.quotaState === 'EXHAUSTED'
                        ? 'danger'
                        : 'neutral'
                }
              >
                {status.quotaState}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <QuotaMeter
                used={status.requestsToday}
                limit={quota.dailyLimit}
                remaining={quota.dailyRemaining}
              />
              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                <Fact label="Burst / minute" value={counter(quota.burstLimit)} />
                <Fact label="Burst left" value={counter(quota.burstRemaining)} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last sync</CardTitle>
              <Badge
                variant={
                  status.lastSync?.status === 'completed'
                    ? 'success'
                    : status.lastSync?.status === 'failed'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {status.lastSync?.status ?? 'none yet'}
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              <dl className="space-y-2.5">
                <Row
                  label="Most recent"
                  value={
                    status.lastSync
                      ? `${status.lastSync.syncType} · ${when(status.lastSync.completedAt ?? status.lastSync.startedAt)}`
                      : 'No sync has been attempted'
                  }
                />
                <Row
                  label="Last success"
                  value={when(
                    status.lastSuccessfulSync?.completedAt ??
                      status.lastSuccessfulSync?.startedAt ??
                      null,
                  )}
                />
                <Row label="Last failure" value={when(status.lastFailedSync?.startedAt ?? null)} />
                <Row
                  label="Last API response"
                  value={
                    quota.lastOutcome
                      ? `${quota.lastStatus ?? '—'} ${quota.lastOutcome}${quota.lastEndpoint ? ` · ${quota.lastEndpoint}` : ''}`
                      : 'No provider call has been made'
                  }
                />
              </dl>

              {status.lastFailedSync?.errorSummary && (
                <p className="max-h-24 overflow-y-auto rounded-lg border border-down/25 bg-down/[0.05] px-3 py-2 font-mono text-fine leading-relaxed text-down">
                  {status.lastFailedSync.errorSummary}
                </p>
              )}

              {quota.lastOutcome && quota.lastOutcome !== 'SUCCESS' && quota.lastMessage && (
                <p className="rounded-lg border border-down/25 bg-down/[0.05] px-3 py-2 font-mono text-fine leading-relaxed text-down">
                  {quota.lastOutcome} — {quota.lastMessage}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data quality</CardTitle>
              <CardDescription>Stored fixtures by validation status</CardDescription>
            </CardHeader>
            <CardBody>
              {status.qualityAlerts.length === 0 ? (
                <p className="text-small text-muted">
                  {status.counts.fixtures === 0
                    ? 'Nothing imported yet.'
                    : 'Every stored fixture passed validation.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {status.qualityAlerts.map((alert) => (
                    <li key={alert.status} className="flex items-center justify-between gap-3">
                      <DataQualityBadge status={alert.status} />
                      <span className="tabular font-mono text-small">
                        {alert.fixtures.toLocaleString('en-US')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ---- Run history -------------------------------------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-h2 font-semibold">Recent sync runs</h2>
          <span className="font-mono text-fine text-muted">Newest first</span>
        </div>
        <DataTable
          columns={RUN_COLUMNS}
          rows={status.recentRuns}
          rowKey={(run) => run.id}
          caption="The most recent ingestion runs, with the records each one wrote"
          empty={
            <Card>
              <CardBody className="text-small text-muted">
                No sync has been attempted yet.
              </CardBody>
            </Card>
          }
        />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-h2 font-semibold">Season coverage</h2>
          <span className="font-mono text-fine text-muted">
            {status.coverageCost === 0
              ? 'Reading is current'
              : `Refresh costs ${status.coverageCost}`}
          </span>
        </div>
        <CoveragePanel
          rows={coverageRows}
          cost={status.coverageCost}
          disabled={!status.apiConfigured || status.quotaState === 'EXHAUSTED'}
        />
      </section>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Configuration and refresh policy</CardTitle>
          <span className="eyebrow">Configured centrally</span>
        </CardHeader>
        <CardBody className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Competitions</p>
            <ul className="mt-2.5 space-y-2">
              {SUPPORTED_LEAGUE_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 text-small">
                  <span>{SUPPORTED_LEAGUES[key].name}</span>
                  <Badge>{SUPPORTED_LEAGUES[key].country}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Refresh windows</p>
            <dl className="mt-2.5 space-y-2">
              {(
                [
                  ['Live fixtures', CACHE_TTL_SECONDS.fixturesLive],
                  ["Today's fixtures", CACHE_TTL_SECONDS.fixturesToday],
                  ['Future fixtures', CACHE_TTL_SECONDS.fixturesFuture],
                  ['Standings', CACHE_TTL_SECONDS.standings],
                  ['Odds', CACHE_TTL_SECONDS.odds],
                ] as const
              ).map(([label, seconds]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 text-small">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular font-mono text-fine">
                    {seconds >= 3600 ? `${Math.round(seconds / 3600)}h` : `${Math.round(seconds / 60)}m`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </CardBody>
      </Card>

      <Note className="mt-6">
        Check fixtures and Sync now are the only actions in the product that reach the provider, and
        each costs a single request: the chosen day&rsquo;s whole slate is fetched once and the
        supported competitions are filtered locally. Check writes nothing — it exists so a wrong
        league id can be told apart from a day with no matches before anything is imported. Syncing
        the same date twice updates in place, keyed on provider and provider fixture id, so it never
        duplicates. Standings, statistics, lineups, injuries and odds are never fetched
        automatically — they are separate syncs, charged per fixture.
      </Note>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="tabular mt-1 font-mono text-small text-ink">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-mono text-fine text-muted">{value}</dd>
    </div>
  );
}
