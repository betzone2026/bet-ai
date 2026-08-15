import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Badge, DataQualityBadge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { getProfile } from '@/lib/auth/server';
import { CACHE_TTL_SECONDS, SUPPORTED_LEAGUES, SUPPORTED_LEAGUE_KEYS } from '@/lib/sports/config';
import { getSportsDataStatus } from '@/lib/sports/status';
import { SyncNowButton } from './sync-button';

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

  return (
    <>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Admin
      </Link>

      <PageHeader
        eyebrow="Internal"
        title="Sports data"
        description="State of the ingestion pipeline: what is configured, what was imported, and what it cost."
        actions={
          <SyncNowButton
            disabled={!status.canSync}
            {...(syncDisabledReason ? { disabledReason: syncDisabledReason } : {})}
          />
        }
      />

      {!status.apiConfigured && (
        <div className="mb-6 rounded-xl border border-alpha/30 bg-alpha/[0.06] px-5 py-4">
          <p className="eyebrow text-alpha">API not configured</p>
          <h2 className="mt-1 font-display text-base font-semibold">
            No provider key is set
          </h2>
          <p className="mt-1 text-sm text-muted">
            Set <code className="font-mono text-xs">API_FOOTBALL_KEY</code> under Site configuration
            → Environment variables to enable imports. The application keeps running on the demo
            dataset until it is present; no request is attempted without it.
          </p>
        </div>
      )}

      {status.apiConfigured && status.quotaState === 'EXHAUSTED' && (
        <div className="mb-6 rounded-xl border border-down/30 bg-down/[0.06] px-5 py-4">
          <p className="eyebrow text-down">Quota exhausted</p>
          <h2 className="mt-1 font-display text-base font-semibold">
            No requests left today
          </h2>
          <p className="mt-1 text-sm text-muted">
            The provider reports 0 of {counter(quota.dailyLimit)} daily requests remaining. Sync is
            disabled until the allowance resets at 00:00 UTC; stored fixtures continue to be served.
          </p>
        </div>
      )}

      {status.apiConfigured && status.quotaState === 'LOW' && (
        <div className="mb-6 rounded-xl border border-alpha/30 bg-alpha/[0.06] px-5 py-4">
          <p className="eyebrow text-alpha">Quota running low</p>
          <h2 className="mt-1 font-display text-base font-semibold">
            {counter(quota.dailyRemaining)} of {counter(quota.dailyLimit)} daily requests left
          </h2>
          <p className="mt-1 text-sm text-muted">
            A fixtures sync costs one request. Detail syncs — standings, statistics, lineups,
            injuries, odds — are charged per fixture, so run them sparingly until the reset.
          </p>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Provider" value={status.provider} hint="Server-side only" />
        <Stat
          label="API configured"
          value={status.apiConfigured ? 'Yes' : 'No'}
          accent={status.apiConfigured}
          hint={status.apiConfigured ? 'Key present in the environment' : 'Serving demo data'}
        />
        <Stat
          label="Requests today"
          value={status.requestsToday.toLocaleString('en-US')}
          hint="Counted per endpoint against the plan quota"
        />
        <Stat
          label="Data mode"
          value={status.hasRealData ? 'REAL' : 'DEMO'}
          accent={status.hasRealData}
          hint={status.hasRealData ? 'Fixtures are served from the database' : 'No fixtures stored yet'}
        />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Daily API limit"
          value={counter(quota.dailyLimit)}
          hint="Requests the plan allows per day"
        />
        <Stat
          label="Daily remaining"
          value={counter(quota.dailyRemaining)}
          accent={status.quotaState === 'OK'}
          hint={
            status.quotaState === 'UNKNOWN'
              ? 'Not yet reported by the provider'
              : `Resets at 00:00 UTC · read ${when(quota.observedAt)}`
          }
        />
        <Stat
          label="Burst limit / minute"
          value={counter(quota.burstLimit)}
          hint="Requests allowed inside one minute"
        />
        <Stat
          label="Burst remaining"
          value={counter(quota.burstRemaining)}
          hint="Refills every minute"
        />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <Stat
          label="Last API response"
          value={
            quota.lastOutcome
              ? `${quota.lastStatus ?? '—'} ${quota.lastOutcome}`
              : 'none yet'
          }
          accent={quota.lastOutcome === 'SUCCESS'}
          hint={
            quota.lastEndpoint
              ? `${quota.lastEndpoint} · ${quota.lastResultCount ?? 0} results · ${when(quota.observedAt)}`
              : 'No provider call has been made'
          }
        />
        <Stat
          label="Last sync status"
          value={status.lastSync?.status ?? 'none yet'}
          accent={status.lastSync?.status === 'completed'}
          hint={
            status.lastSync
              ? `${status.lastSync.syncType} · ${when(status.lastSync.completedAt ?? status.lastSync.startedAt)}`
              : 'No sync has been attempted'
          }
        />
      </section>

      {quota.lastOutcome && quota.lastOutcome !== 'SUCCESS' && quota.lastMessage && (
        <p className="mt-3 rounded-xl border border-down/30 bg-down/[0.05] px-4 py-3 text-xs leading-relaxed text-down">
          <span className="font-mono">{quota.lastOutcome}</span> — {quota.lastMessage}
        </p>
      )}

      <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Fixtures" value={status.counts.fixtures.toLocaleString('en-US')} />
        <Stat label="Teams" value={status.counts.teams.toLocaleString('en-US')} />
        <Stat label="Leagues" value={status.counts.leagues.toLocaleString('en-US')} />
        <Stat
          label="Odds snapshots"
          value={status.counts.oddsSnapshots.toLocaleString('en-US')}
          hint="Append-only price history"
        />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent sync runs</CardTitle>
            <span className="eyebrow">Newest first</span>
          </CardHeader>
          <CardBody className="p-0">
            {status.recentRuns.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                No sync has been attempted yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th className="eyebrow px-4 py-2.5 text-left font-normal">Type</th>
                    <th className="eyebrow px-4 py-2.5 text-left font-normal">Status</th>
                    <th className="eyebrow px-4 py-2.5 text-right font-normal">In / New / Fail</th>
                    <th className="eyebrow px-4 py-2.5 text-right font-normal">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {status.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="max-w-[22ch] truncate px-4 py-2.5 font-mono text-xs">
                        {run.syncType}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            run.status === 'completed'
                              ? 'font-mono text-xs text-up'
                              : run.status === 'failed'
                                ? 'font-mono text-xs text-down'
                                : 'font-mono text-xs text-muted'
                          }
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="tabular px-4 py-2.5 text-right font-mono text-xs text-muted">
                        {run.recordsReceived} / {run.recordsInserted} / {run.recordsFailed}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                        {when(run.startedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Last outcomes</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div>
                <p className="eyebrow">Last successful sync</p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {when(status.lastSuccessfulSync?.completedAt ?? status.lastSuccessfulSync?.startedAt ?? null)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Last failed sync</p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {when(status.lastFailedSync?.startedAt ?? null)}
                </p>
                {status.lastFailedSync?.errorSummary && (
                  <p className="mt-1.5 max-h-24 overflow-y-auto text-xs text-down">
                    {status.lastFailedSync.errorSummary}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data quality</CardTitle>
            </CardHeader>
            <CardBody>
              {status.qualityAlerts.length === 0 ? (
                <p className="text-sm text-muted">
                  {status.counts.fixtures === 0
                    ? 'Nothing imported yet.'
                    : 'Every stored fixture passed validation.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {status.qualityAlerts.map((alert) => (
                    <li key={alert.status} className="flex items-center justify-between gap-3">
                      <DataQualityBadge status={alert.status} />
                      <span className="tabular font-mono text-sm">
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

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Coverage and refresh policy</CardTitle>
          <span className="eyebrow">Configured centrally</span>
        </CardHeader>
        <CardBody className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Competitions</p>
            <ul className="mt-2 space-y-2">
              {SUPPORTED_LEAGUE_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span>{SUPPORTED_LEAGUES[key].name}</span>
                  <Badge>{SUPPORTED_LEAGUES[key].country}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Refresh windows</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {(
                [
                  ['Live fixtures', CACHE_TTL_SECONDS.fixturesLive],
                  ["Today's fixtures", CACHE_TTL_SECONDS.fixturesToday],
                  ['Future fixtures', CACHE_TTL_SECONDS.fixturesFuture],
                  ['Standings', CACHE_TTL_SECONDS.standings],
                  ['Odds', CACHE_TTL_SECONDS.odds],
                ] as const
              ).map(([label, seconds]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular font-mono text-xs">
                    {seconds >= 3600 ? `${Math.round(seconds / 3600)}h` : `${Math.round(seconds / 60)}m`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </CardBody>
      </Card>

      <p className="mt-6 rounded-xl border border-line bg-surface/50 px-4 py-3 text-xs leading-relaxed text-muted">
        A sync is the only action in the product that reaches the provider. A fixtures sync costs a
        single request: the day&rsquo;s whole slate is fetched once and the supported competitions
        are filtered locally. Standings, statistics, lineups, injuries and odds are never fetched
        automatically — they are separate syncs, charged per fixture. A run is skipped when stored
        data is still inside its refresh window; press Sync now to override that and fetch regardless.
      </p>
    </>
  );
}
