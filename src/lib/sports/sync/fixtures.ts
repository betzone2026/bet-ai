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
  SUPPORTED_LEAGUE_KEYS,
  type LeagueKey,
} from '../config.ts';
import { describeError, isSportsProviderError } from '../errors.ts';
import { sportsLog } from '../logging.ts';
import type { SportsDataProvider } from '../provider.ts';
import { dedupeFixtureBundles, validateFixtureBundle } from '../quality.ts';
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
  recordsReceived: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  duplicatesIgnored: number;
  invalidFixtures: number;
  partialFixtures: number;
  apiRequests: number;
  errors: string[];
  /** Set when the run was skipped because stored data was still fresh. */
  skippedReason?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
    recordsReceived: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    duplicatesIgnored: 0,
    invalidFixtures: 0,
    partialFixtures: 0,
    apiRequests: 0,
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
    return summary;
  }

  // Freshness guard: the cheapest provider request is the one not made.
  if (!options.force) {
    const ttl = date === today() ? CACHE_TTL_SECONDS.fixturesToday : CACHE_TTL_SECONDS.fixturesFuture;
    if (await hasRecentSuccess(providerName, `${syncType}:${date}`, ttl)) {
      summary.status = 'skipped';
      summary.skippedReason = 'FRESH';
      return summary;
    }
  }

  const runId = await startSyncRun({
    provider: providerName,
    syncType: `${syncType}:${date}`,
    params: { date, leagues },
    triggeredBy: options.triggeredBy ?? null,
  });
  summary.runId = runId;

  try {
    const bundles = await provider.getFixtures({ date, leagues });
    summary.recordsReceived = bundles.length;

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

    if (leaguesToWrite.size > 0) await upsertLeagues([...leaguesToWrite.values()]);
    if (seasonsToWrite.size > 0) await upsertSeasons([...seasonsToWrite.values()]);
    if (teamsToWrite.size > 0) await upsertTeams([...teamsToWrite.values()]);

    const written = await upsertFixtures(fixtureWrites);
    summary.recordsInserted = written.inserted;
    summary.recordsUpdated = written.updated;
    summary.status = summary.recordsFailed > 0 ? 'partial' : 'completed';
  } catch (error) {
    summary.status = 'failed';
    summary.errors.push(describeError(error));
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

  const usage = provider.usage();
  summary.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);

  await completeSyncRun(runId, {
    status: summary.status,
    counts: {
      recordsReceived: summary.recordsReceived,
      recordsInserted: summary.recordsInserted,
      recordsUpdated: summary.recordsUpdated,
      recordsFailed: summary.recordsFailed,
      apiRequests: summary.apiRequests,
    },
    errors: summary.errors,
  });

  return summary;
}
