/**
 * Per-fixture detail import: statistics, lineups, injuries and odds.
 *
 * Kept apart from the fixture list sync because it costs several requests per
 * fixture rather than one per competition, and because each piece has its own
 * TTL — a finished match's statistics never change, while its price history was
 * only ever worth capturing before kickoff.
 *
 * Odds are appended, never replaced. See `src/lib/sports/odds.ts` for why.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsFixtures } from '@/../db/schema';
import { CACHE_TTL_SECONDS, DEFAULT_PROVIDER, fixtureTtlSeconds } from '../config.ts';
import { describeError } from '../errors.ts';
import type { SportsDataProvider } from '../provider.ts';
import { assessFixtureQuality } from '../quality.ts';
import { getProvider } from '../registry.ts';
import {
  appendOddsSnapshots,
  upsertFixtureStatistics,
  upsertInjuries,
  upsertLineups,
} from '../repository.ts';
import type { DataQualityIssue, FixtureStatus } from '../types.ts';
import { recordApiRequests } from '../usage.ts';
import { completeSyncRun, startSyncRun, type SyncRunStatus } from './runs.ts';

export interface SyncFixtureDetailOptions {
  fixtureId: string;
  provider?: string;
  triggeredBy?: string | null;
  /** Which pieces to fetch. Defaults to everything the lifecycle justifies. */
  include?: Array<'statistics' | 'lineups' | 'injuries' | 'odds'>;
  providerInstance?: SportsDataProvider;
}

export interface SyncFixtureDetailSummary {
  runId: string | null;
  provider: string;
  status: SyncRunStatus | 'skipped';
  fixtureId: string;
  statisticsWritten: boolean;
  lineupsWritten: number;
  injuriesWritten: number;
  oddsSnapshotsWritten: number;
  apiRequests: number;
  errors: string[];
  skippedReason?: string;
}

/**
 * Chooses what is worth fetching for a fixture in this state.
 *
 * A match that finished last week has no lineups to announce and no prices left
 * to move; asking for them anyway is quota spent on nothing.
 */
function defaultInclude(status: FixtureStatus): Array<'statistics' | 'lineups' | 'injuries' | 'odds'> {
  if (status === 'finished') return ['statistics', 'lineups'];
  if (status === 'live') return ['statistics', 'lineups'];
  if (status === 'scheduled') return ['lineups', 'injuries', 'odds'];
  return [];
}

export async function syncFixtureDetail(
  options: SyncFixtureDetailOptions,
): Promise<SyncFixtureDetailSummary> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const summary: SyncFixtureDetailSummary = {
    runId: null,
    provider: providerName,
    status: 'failed',
    fixtureId: options.fixtureId,
    statisticsWritten: false,
    lineupsWritten: 0,
    injuriesWritten: 0,
    oddsSnapshotsWritten: 0,
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

  const [fixture] = await db
    .select()
    .from(sportsFixtures)
    .where(eq(sportsFixtures.id, options.fixtureId))
    .limit(1);

  if (!fixture) {
    summary.status = 'skipped';
    summary.skippedReason = 'FIXTURE_NOT_STORED';
    return summary;
  }

  const include = options.include ?? defaultInclude(fixture.status);
  if (include.length === 0) {
    summary.status = 'skipped';
    summary.skippedReason = 'NOTHING_TO_FETCH';
    return summary;
  }

  const runId = await startSyncRun({
    provider: providerName,
    syncType: `fixture-detail:${options.fixtureId}`,
    params: { fixtureId: options.fixtureId, include },
    triggeredBy: options.triggeredBy ?? null,
  });
  summary.runId = runId;

  let hasStatistics = false;

  if (include.includes('statistics')) {
    try {
      const stats = await provider.getFixtureStatistics(options.fixtureId, {
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
      });
      if (stats) {
        await upsertFixtureStatistics(stats);
        summary.statisticsWritten = true;
        hasStatistics = true;
      }
    } catch (error) {
      summary.errors.push(`statistics: ${describeError(error)}`);
    }
  }

  if (include.includes('lineups')) {
    try {
      const lineups = await provider.getLineups(options.fixtureId);
      await upsertLineups(lineups);
      summary.lineupsWritten = lineups.length;
    } catch (error) {
      summary.errors.push(`lineups: ${describeError(error)}`);
    }
  }

  if (include.includes('injuries')) {
    try {
      const injuries = await provider.getInjuries({ fixtureId: options.fixtureId });
      // Injuries name players on teams the fixture already introduced, so the
      // foreign key holds; anything else is dropped by the filter below.
      const known = injuries.filter(
        (injury) => injury.teamId === fixture.homeTeamId || injury.teamId === fixture.awayTeamId,
      );
      await upsertInjuries(known);
      summary.injuriesWritten = known.length;
    } catch (error) {
      summary.errors.push(`injuries: ${describeError(error)}`);
    }
  }

  let hasOdds = false;
  if (include.includes('odds')) {
    try {
      const odds = await provider.getOdds(options.fixtureId);
      summary.oddsSnapshotsWritten = await appendOddsSnapshots(options.fixtureId, odds);
      hasOdds = odds.length > 0;
    } catch (error) {
      summary.errors.push(`odds: ${describeError(error)}`);
    }
  }

  // Re-grade the fixture now that we know what surrounding data exists.
  try {
    const report = assessFixtureQuality({
      fixture: { status: fixture.status, kickoff: fixture.kickoff.toISOString() },
      hasStatistics,
      hasOdds,
      statisticsUpdatedAt: hasStatistics ? new Date() : null,
      baseIssues: (fixture.qualityIssues as DataQualityIssue[]).filter(
        (issue) => issue !== 'missing_odds' && issue !== 'missing_statistics',
      ),
      statisticsTtlSeconds:
        fixture.status === 'finished'
          ? CACHE_TTL_SECONDS.statisticsCompleted
          : fixtureTtlSeconds(fixture.kickoff, fixture.status),
    });

    await db
      .update(sportsFixtures)
      .set({ dataQuality: report.status, qualityIssues: report.issues, updatedAt: new Date() })
      .where(eq(sportsFixtures.id, options.fixtureId));
  } catch (error) {
    summary.errors.push(`quality: ${describeError(error)}`);
  }

  summary.status = summary.errors.length === 0 ? 'completed' : 'partial';

  const usage = provider.usage();
  summary.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);

  await completeSyncRun(runId, {
    status: summary.status,
    counts: {
      recordsReceived:
        (summary.statisticsWritten ? 1 : 0) +
        summary.lineupsWritten +
        summary.injuriesWritten +
        summary.oddsSnapshotsWritten,
      recordsInserted: summary.oddsSnapshotsWritten,
      recordsUpdated: summary.lineupsWritten + summary.injuriesWritten,
      recordsFailed: summary.errors.length,
      apiRequests: summary.apiRequests,
    },
    errors: summary.errors,
  });

  return summary;
}
