/**
 * Fixture import.
 *
 * The one write path that turns a provider response into SportAlpha rows:
 *
 *   provider → normalise → validate → upsert leagues → upsert teams →
 *   upsert fixtures → close the sync run → return a summary
 *
 * Ordering is not incidental. Fixtures reference leagues and teams, so those
 * are written first; and the sync run is opened before the provider call so a
 * failure is still recorded.
 *
 * Nothing here throws at the caller: a failed import is a recorded outcome, not
 * an exception the admin screen has to catch.
 */

import {
  CACHE_TTL_SECONDS,
  DEFAULT_PROVIDER,
  MAX_FIXTURES_PER_SYNC,
  SUPPORTED_LEAGUE_KEYS,
  type LeagueKey,
} from '../config.ts';
import { todayIso } from '../dates.ts';
import { SportsProviderError, describeError, isSportsProviderError } from '../errors.ts';
import { sportsLog } from '../logging.ts';
import { describeFixtureOutcome } from '../messages.ts';
import type { CompetitionSighting, SportsDataProvider } from '../provider.ts';
import { dedupeFixtureBundles, validateFixtureBundle } from '../quality.ts';
import { canSpendQuota, readProviderQuota, recordQuotaObservation } from '../quota.ts';
import { getProvider } from '../registry.ts';
import { upsertFixtures, upsertLeagues, upsertSeasons, upsertTeams, type FixtureWrite } from '../repository.ts';
import type { League, Season, Team } from '../types.ts';
import { recordApiRequests } from '../usage.ts';
import { completeSyncRun, hasRecentSuccess, startSyncRun, type SyncRunStatus } from './runs.ts';

export interface SyncFixturesOptions {
  /** ISO date (`YYYY-MM-DD`, UTC). Defaults to today. */
  date?: string;
  leagues?: LeagueKey[];
  provider?: string;
  /** Label recorded on the run, e.g. `fixtures` or `fixtures:manual`. */
  syncType?: string;
  /** Who asked for it — an admin id, or `schedule`. */
  triggeredBy?: string | null;
  /** Skips the freshness guard and calls the provider regardless. */
  force?: boolean;
  /** Injected in tests; production resolves through the registry. */
  providerInstance?: SportsDataProvider;
}

export interface SyncFixturesSummary {
  runId: string | null;
  provider: string;
  status: SyncRunStatus | 'skipped';
  date: string;
  leagues: LeagueKey[];
  /** Fixtures the provider sent for the date, before the league filter. */
  providerReturned: number;
  /** Of those, the ones in a configured competition. */
  recordsMatched: number;
  recordsReceived: number;
  recordsInserted: number;
  recordsUpdated: number;
  /** Already stored and identical, so no write was made. */
  recordsUnchanged: number;
  recordsFailed: number;
  duplicatesIgnored: number;
  invalidFixtures: number;
  partialFixtures: number;
  apiRequests: number;
  /** Competitions present in the response, whether configured or not. */
  competitions: CompetitionSighting[];
  /**
   * One sentence an operator can act on. Distinguishes an empty day from a
   * league filter that matched nothing — see `../messages.ts`.
   */
  message: string;
  errors: string[];
  /** Set when the run was skipped because stored data was still fresh. */
  skippedReason?: string;
}

function today(): string {
  return todayIso();
}

/**
 * Wraps a write so a storage failure is reported as one.
 *
 * Without this, a broken database surfaces as an opaque `[UNEXPECTED]` line and
 * an admin goes looking at the provider — which is working fine. The distinction
 * matters because the two have nothing in common: one is fixed by waiting or by
 * a new key, the other by fixing the database.
 */
async function write<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    throw new SportsProviderError(
      'DATABASE_ERROR',
      'Fixtures were fetched but could not be written to the database.',
      { provider: DEFAULT_PROVIDER, cause },
    );
  }
}

/**
 * Imports one day of fixtures for the configured competitions.
 *
 * Invalid fixtures are counted and skipped; incomplete ones are stored with a
 * `PARTIAL` grade. Refusing to write a fixture because one optional field is
 * missing would throw away the kickoff, the teams and the result — all of which
 * are correct.
 */
export async function syncFixtures(
  options: SyncFixturesOptions = {},
): Promise<SyncFixturesSummary> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const date = options.date ?? today();
  const leagues = options.leagues?.length ? options.leagues : SUPPORTED_LEAGUE_KEYS;
  const syncType = options.syncType ?? 'fixtures';

  const summary: SyncFixturesSummary = {
    runId: null,
    provider: providerName,
    status: 'failed',
    date,
    leagues,
    providerReturned: 0,
    recordsMatched: 0,
    recordsReceived: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsUnchanged: 0,
    recordsFailed: 0,
    duplicatesIgnored: 0,
    invalidFixtures: 0,
    partialFixtures: 0,
    apiRequests: 0,
    competitions: [],
    message: '',
    errors: [],
  };

  let provider: SportsDataProvider;
  try {
    provider = options.providerInstance ?? getProvider(providerName);
  } catch (error) {
    summary.errors.push(describeError(error));
    return summary;
  }

  if (!provider.isConfigured()) {
    summary.status = 'skipped';
    summary.skippedReason = 'API_NOT_CONFIGURED';
    summary.message = 'No provider key is configured, so no request was attempted.';
    return summary;
  }

  // Freshness guard: the cheapest provider request is the one not made.
  if (!options.force) {
    const ttl = date === today() ? CACHE_TTL_SECONDS.fixturesToday : CACHE_TTL_SECONDS.fixturesFuture;
    if (await hasRecentSuccess(providerName, `${syncType}:${date}`, ttl)) {
      summary.status = 'skipped';
      summary.skippedReason = 'FRESH';
      summary.message = `${date} was already imported inside its refresh window; no request was made.`;
      return summary;
    }
  }

  // Quota guard. Only a measured zero stops the run — an unknown allowance is
  // allowed through, because attempting the request is how it gets measured.
  // `force` overrides freshness, never the provider's own ceiling.
  const quota = await readProviderQuota(providerName);
  if (!canSpendQuota(quota)) {
    summary.status = 'skipped';
    summary.skippedReason = 'RATE_LIMITED';
    summary.errors.push(
      `[RATE_LIMITED] the daily allowance is spent (0 of ${quota.dailyLimit ?? '?'} left); it resets at 00:00 UTC.`,
    );
    summary.message = summary.errors[0] ?? 'The daily request allowance is spent.';
    return summary;
  }

  const runId = await startSyncRun({
    provider: providerName,
    syncType: `${syncType}:${date}`,
    params: { date, leagues },
    triggeredBy: options.triggeredBy ?? null,
  });
  summary.runId = runId;

  try {
    // The inspecting form of the call, so the two counts an operator needs —
    // what arrived and what survived the league filter — are kept rather than
    // reduced away. It is the same single request either way.
    const inspection = await provider.inspectFixtures({ date, leagues });
    summary.providerReturned = inspection.providerReturned;
    summary.recordsMatched = inspection.matched;
    summary.competitions = inspection.competitions;

    const bundles = inspection.bundles;
    summary.recordsReceived = bundles.length;

    if (inspection.unmappable > 0) {
      summary.recordsFailed += inspection.unmappable;
      summary.errors.push(
        `${inspection.unmappable} matched fixture(s) were missing the identifiers required to store them.`,
      );
    }
    if (inspection.truncated) {
      summary.errors.push(
        `the response exceeded the ${MAX_FIXTURES_PER_SYNC}-fixture ceiling for one sync; the remainder was not imported.`,
      );
    }

    const { unique, duplicates } = dedupeFixtureBundles(bundles);
    summary.duplicatesIgnored = duplicates.length;

    const leaguesToWrite = new Map<string, League>();
    const seasonsToWrite = new Map<string, Season>();
    const teamsToWrite = new Map<string, Team>();
    const fixtureWrites: FixtureWrite[] = [];

    const now = new Date();
    for (const bundle of unique) {
      const report = validateFixtureBundle(bundle, now);

      if (report.status === 'INVALID') {
        summary.invalidFixtures += 1;
        summary.recordsFailed += 1;
        summary.errors.push(
          `fixture ${bundle.fixture.providerId} rejected: ${report.issues.join(', ')}`,
        );
        continue;
      }
      if (report.status !== 'GOOD') summary.partialFixtures += 1;

      leaguesToWrite.set(bundle.league.id, bundle.league);
      if (bundle.season) seasonsToWrite.set(bundle.season.id, bundle.season);
      teamsToWrite.set(bundle.homeTeam.id, bundle.homeTeam);
      teamsToWrite.set(bundle.awayTeam.id, bundle.awayTeam);
      fixtureWrites.push({
        fixture: bundle.fixture,
        quality: report.status,
        issues: report.issues,
      });
    }

    if (leaguesToWrite.size > 0) await write(() => upsertLeagues([...leaguesToWrite.values()]));
    if (seasonsToWrite.size > 0) await write(() => upsertSeasons([...seasonsToWrite.values()]));
    if (teamsToWrite.size > 0) await write(() => upsertTeams([...teamsToWrite.values()]));

    const written = await write(() => upsertFixtures(fixtureWrites));
    summary.recordsInserted = written.inserted;
    summary.recordsUpdated = written.updated;
    summary.recordsUnchanged = written.unchanged;
    summary.status = summary.recordsFailed > 0 ? 'partial' : 'completed';
    summary.message = describeFixtureOutcome({
      providerReturned: summary.providerReturned,
      matched: summary.recordsMatched,
      date,
      provider: providerName,
    });
  } catch (error) {
    summary.status = 'failed';
    summary.errors.push(describeError(error));
    summary.message = describeError(error);
    if (isSportsProviderError(error)) {
      sportsLog.error('fixture sync failed', {
        code: error.code,
        endpoint: error.endpoint,
        status: error.status,
      });
    } else {
      sportsLog.error('fixture sync failed with an unexpected error');
    }
  }

  // Record what the provider said about the allowance, whichever way the run
  // went: a failed call is often the most informative reading there is.
  const report = provider.lastResponse?.() ?? null;
  if (report) await recordQuotaObservation(providerName, report);

  const usage = provider.usage();
  summary.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);

  await completeSyncRun(runId, {
    status: summary.status,
    counts: {
      providerReturned: summary.providerReturned,
      recordsMatched: summary.recordsMatched,
      recordsReceived: summary.recordsReceived,
      recordsInserted: summary.recordsInserted,
      recordsUpdated: summary.recordsUpdated,
      recordsUnchanged: summary.recordsUnchanged,
      recordsFailed: summary.recordsFailed,
      apiRequests: summary.apiRequests,
    },
    errors: summary.errors,
  });

  return summary;
}
