/**
 * Operational status of the sports-data pipeline.
 *
 * Everything the admin screen needs to answer one question: is real data
 * arriving, and if not, why not? Reads only — nothing here calls a provider, so
 * opening the admin page costs no quota.
 */

import { count, eq, sql } from 'drizzle-orm';
import { db } from '@/../db';
import {
  oddsSnapshots,
  sportsFixtures,
  sportsLeagues,
  sportsTeams,
} from '@/../db/schema';
import { DEFAULT_PROVIDER, SUPPORTED_LEAGUE_KEYS } from './config.ts';
import { quotaState, readProviderQuota, type ProviderQuota, type QuotaState } from './quota.ts';
import { isProviderConfigured } from './registry.ts';
import { lastSyncRun, recentSyncRuns, type SyncRunRow } from './sync/runs.ts';
import type { DataQualityStatus } from './types.ts';
import { requestsToday } from './usage.ts';

export interface SportsDataStatus {
  provider: string;
  /** False when `API_FOOTBALL_KEY` is absent. The app still runs. */
  apiConfigured: boolean;
  supportedLeagues: string[];
  lastSuccessfulSync: SyncRunRow | null;
  lastFailedSync: SyncRunRow | null;
  /** Most recent run of any outcome, which is what "last sync status" means. */
  lastSync: SyncRunRow | null;
  recentRuns: SyncRunRow[];
  requestsToday: number;
  /** Latest allowance reported by the provider itself. */
  quota: ProviderQuota;
  quotaState: QuotaState;
  /** False only when the allowance is measured at zero. */
  canSync: boolean;
  counts: {
    fixtures: number;
    teams: number;
    leagues: number;
    oddsSnapshots: number;
  };
  qualityAlerts: Array<{ status: DataQualityStatus; fixtures: number }>;
  /** True when the database has fixtures the interface can show. */
  hasRealData: boolean;
}

const UNKNOWN_QUOTA: ProviderQuota = {
  provider: DEFAULT_PROVIDER,
  dailyLimit: null,
  dailyRemaining: null,
  burstLimit: null,
  burstRemaining: null,
  lastStatus: null,
  lastEndpoint: null,
  lastOutcome: null,
  lastMessage: null,
  lastResultCount: null,
  observedAt: null,
};

/** Empty status used when the database itself is unreachable. */
function emptyStatus(apiConfigured: boolean): SportsDataStatus {
  return {
    provider: DEFAULT_PROVIDER,
    apiConfigured,
    supportedLeagues: [...SUPPORTED_LEAGUE_KEYS],
    lastSuccessfulSync: null,
    lastFailedSync: null,
    lastSync: null,
    recentRuns: [],
    requestsToday: 0,
    quota: UNKNOWN_QUOTA,
    quotaState: 'UNKNOWN',
    // An unreadable database says nothing about the provider's allowance, and
    // guessing "exhausted" would disable the one control that could fix things.
    canSync: apiConfigured,
    counts: { fixtures: 0, teams: 0, leagues: 0, oddsSnapshots: 0 },
    qualityAlerts: [],
    hasRealData: false,
  };
}

export async function getSportsDataStatus(): Promise<SportsDataStatus> {
  const apiConfigured = isProviderConfigured();

  try {
    const [fixtures, teams, leagues, odds, quality, success, failure, recent, requests, quota] =
      await Promise.all([
        db.select({ value: count() }).from(sportsFixtures),
        db.select({ value: count() }).from(sportsTeams),
        db.select({ value: count() }).from(sportsLeagues),
        db.select({ value: count() }).from(oddsSnapshots),
        db
          .select({ status: sportsFixtures.dataQuality, value: count() })
          .from(sportsFixtures)
          .groupBy(sportsFixtures.dataQuality),
        lastSyncRun('completed'),
        lastSyncRun('failed'),
        recentSyncRuns(8),
        requestsToday(DEFAULT_PROVIDER),
        readProviderQuota(DEFAULT_PROVIDER),
      ]);

    const fixtureCount = fixtures[0]?.value ?? 0;
    const state = quotaState(quota);

    return {
      provider: DEFAULT_PROVIDER,
      apiConfigured,
      supportedLeagues: [...SUPPORTED_LEAGUE_KEYS],
      lastSuccessfulSync: success,
      lastFailedSync: failure,
      lastSync: recent[0] ?? null,
      recentRuns: recent,
      requestsToday: requests,
      quota,
      quotaState: state,
      canSync: apiConfigured && state !== 'EXHAUSTED',
      counts: {
        fixtures: fixtureCount,
        teams: teams[0]?.value ?? 0,
        leagues: leagues[0]?.value ?? 0,
        oddsSnapshots: odds[0]?.value ?? 0,
      },
      qualityAlerts: quality
        .filter((row) => row.status !== 'GOOD')
        .map((row) => ({ status: row.status, fixtures: row.value })),
      hasRealData: fixtureCount > 0,
    };
  } catch {
    // The admin screen must render even when the database is down; the empty
    // status is itself the diagnosis.
    return emptyStatus(apiConfigured);
  }
}

/** Cheap check used by the dashboard to decide between real and demo data. */
export async function hasStoredFixtures(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: sql<number>`1` })
      .from(sportsFixtures)
      .limit(1);
    return row !== undefined;
  } catch {
    return false;
  }
}

/** Fixture count for a single competition, used by the admin table. */
export async function fixturesForLeague(leagueId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(sportsFixtures)
    .where(eq(sportsFixtures.leagueId, leagueId));
  return row?.value ?? 0;
}
