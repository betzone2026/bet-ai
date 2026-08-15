/**
 * Standings import.
 *
 * Separate from fixtures because it changes on a different clock: a table only
 * moves when a round finishes, so it has its own TTL and its own sync run
 * rather than riding along with every fixture refresh.
 *
 * Standings reference teams that fixtures normally introduce first. When a team
 * in the table has never been seen, its row is skipped rather than invented —
 * the next fixture sync brings it in, and the table fills itself.
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsTeams } from '@/../db/schema';
import {
  CACHE_TTL_SECONDS,
  DEFAULT_PROVIDER,
  SUPPORTED_LEAGUE_KEYS,
  seasonForDate,
  type LeagueKey,
} from '../config.ts';
import { describeError } from '../errors.ts';
import type { SportsDataProvider } from '../provider.ts';
import { getProvider } from '../registry.ts';
import { upsertStandings } from '../repository.ts';
import type { Standing } from '../types.ts';
import { recordApiRequests } from '../usage.ts';
import { completeSyncRun, hasRecentSuccess, startSyncRun, type SyncRunStatus } from './runs.ts';

export interface SyncStandingsOptions {
  leagues?: LeagueKey[];
  season?: number;
  provider?: string;
  triggeredBy?: string | null;
  force?: boolean;
  providerInstance?: SportsDataProvider;
}

export interface SyncStandingsSummary {
  runId: string | null;
  provider: string;
  status: SyncRunStatus | 'skipped';
  leagues: LeagueKey[];
  recordsReceived: number;
  recordsWritten: number;
  recordsFailed: number;
  apiRequests: number;
  errors: string[];
  skippedReason?: string;
}

export async function syncStandings(
  options: SyncStandingsOptions = {},
): Promise<SyncStandingsSummary> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const leagues = options.leagues?.length ? options.leagues : SUPPORTED_LEAGUE_KEYS;
  const season = options.season ?? seasonForDate(new Date());

  const summary: SyncStandingsSummary = {
    runId: null,
    provider: providerName,
    status: 'failed',
    leagues,
    recordsReceived: 0,
    recordsWritten: 0,
    recordsFailed: 0,
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

  const syncType = `standings:${season}`;
  if (!options.force && (await hasRecentSuccess(providerName, syncType, CACHE_TTL_SECONDS.standings))) {
    summary.status = 'skipped';
    summary.skippedReason = 'FRESH';
    return summary;
  }

  const runId = await startSyncRun({
    provider: providerName,
    syncType,
    params: { leagues, season },
    triggeredBy: options.triggeredBy ?? null,
  });
  summary.runId = runId;

  const collected: Standing[] = [];
  for (const league of leagues) {
    try {
      const rows = await provider.getStandings({ league, season });
      collected.push(...rows);
    } catch (error) {
      summary.recordsFailed += 1;
      summary.errors.push(`${league}: ${describeError(error)}`);
    }
  }
  summary.recordsReceived = collected.length;

  if (collected.length > 0) {
    const teamIds = [...new Set(collected.map((row) => row.teamId))];
    const known = new Set(
      (
        await db.select({ id: sportsTeams.id }).from(sportsTeams).where(inArray(sportsTeams.id, teamIds))
      ).map((row) => row.id),
    );

    const writable = collected.filter((row) => known.has(row.teamId));
    const skipped = collected.length - writable.length;
    if (skipped > 0) {
      summary.recordsFailed += skipped;
      summary.errors.push(`${skipped} standing rows skipped: team not yet imported`);
    }

    try {
      await upsertStandings(writable);
      summary.recordsWritten = writable.length;
    } catch (error) {
      summary.recordsFailed += writable.length;
      summary.errors.push(describeError(error));
    }
  }

  summary.status =
    summary.recordsFailed > 0
      ? summary.recordsWritten > 0
        ? 'partial'
        : 'failed'
      : 'completed';

  const usage = provider.usage();
  summary.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);

  await completeSyncRun(runId, {
    status: summary.status,
    counts: {
      recordsReceived: summary.recordsReceived,
      recordsInserted: summary.recordsWritten,
      recordsUpdated: 0,
      recordsFailed: summary.recordsFailed,
      apiRequests: summary.apiRequests,
    },
    errors: summary.errors,
  });

  return summary;
}
