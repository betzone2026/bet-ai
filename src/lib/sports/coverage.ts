/**
 * Season and coverage diagnostic.
 *
 * Answers, per configured competition: which provider league id we send, which
 * seasons the key can actually see, which of them the provider calls current,
 * and whether fixtures are served for them at all.
 *
 * It exists to replace a guess. Assuming a plan's season window — "Free only
 * covers 2022-2024" — puts a constant in the codebase that is wrong the day the
 * plan changes and wrong *silently*: syncs keep succeeding and importing
 * nothing. The provider publishes the answer, so the answer is fetched, stored,
 * and re-read for free until someone asks for it again.
 *
 * Cost: one request per competition, three on the current slate. Cached in the
 * database for `CACHE_TTL_SECONDS.leagues`, so repeated visits to the admin
 * screen cost nothing and only an explicit refresh spends quota.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsLeagueCoverage } from '@/../db/schema';
import {
  CACHE_TTL_SECONDS,
  DEFAULT_PROVIDER,
  SUPPORTED_LEAGUES,
  SUPPORTED_LEAGUE_KEYS,
  isFresh,
  providerLeagueId,
  type LeagueKey,
} from './config.ts';
import { describeError } from './errors.ts';
import { sportsLog } from './logging.ts';
import type { LeagueCoverageReport, SeasonCoverage, SportsDataProvider } from './provider.ts';
import { canSpendQuota, readProviderQuota, recordQuotaObservation, type ProviderQuota } from './quota.ts';
import { getProvider } from './registry.ts';
import { recordApiRequests } from './usage.ts';

/** A stored reading, which is a report plus when it was taken. */
export interface LeagueCoverageRow extends LeagueCoverageReport {
  provider: string;
  checkedAt: Date | null;
  /** False for a row that has never been checked — a placeholder, not a result. */
  checked: boolean;
}

/**
 * The configured slate with no reading yet taken.
 *
 * Rendered instead of an empty table so the admin screen always shows which
 * competitions and which provider ids are configured, even before the
 * diagnostic has ever run. That configuration is itself half the answer.
 */
function unchecked(leagueKey: LeagueKey, provider: string): LeagueCoverageRow {
  const configured = SUPPORTED_LEAGUES[leagueKey];
  return {
    provider,
    leagueKey,
    providerLeagueId: providerLeagueId(leagueKey, provider),
    name: configured?.name ?? leagueKey,
    country: configured?.country ?? null,
    currentSeason: null,
    latestSeason: null,
    seasons: [],
    fixturesAvailable: false,
    error: null,
    checkedAt: null,
    checked: false,
  };
}

/**
 * Latest stored reading for every configured competition.
 *
 * Read-only and free: this is what the admin page renders on load, so opening
 * it never touches the provider.
 */
export async function readLeagueCoverage(
  provider: string = DEFAULT_PROVIDER,
): Promise<LeagueCoverageRow[]> {
  const rows = new Map<string, LeagueCoverageRow>();

  try {
    const stored = await db
      .select()
      .from(sportsLeagueCoverage)
      .where(eq(sportsLeagueCoverage.provider, provider));

    for (const row of stored) {
      rows.set(row.leagueKey, {
        provider: row.provider,
        leagueKey: row.leagueKey,
        providerLeagueId: row.providerLeagueId,
        name: row.name,
        country: row.country,
        currentSeason: row.currentSeason,
        latestSeason: row.latestSeason,
        seasons: (row.seasons ?? []) as SeasonCoverage[],
        fixturesAvailable: row.fixturesAvailable,
        error: row.error,
        checkedAt: row.checkedAt,
        checked: true,
      });
    }
  } catch {
    // An unreadable table is not a reason to hide the configuration.
    sportsLog.warn('league coverage could not be read');
  }

  return SUPPORTED_LEAGUE_KEYS.map(
    (key) => rows.get(key) ?? unchecked(key, provider),
  );
}

async function storeCoverage(provider: string, report: LeagueCoverageReport): Promise<void> {
  try {
    await db
      .insert(sportsLeagueCoverage)
      .values({
        provider,
        leagueKey: report.leagueKey,
        providerLeagueId: report.providerLeagueId,
        name: report.name,
        country: report.country,
        currentSeason: report.currentSeason,
        latestSeason: report.latestSeason,
        seasons: report.seasons,
        fixturesAvailable: report.fixturesAvailable,
        error: report.error,
        checkedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [sportsLeagueCoverage.provider, sportsLeagueCoverage.leagueKey],
        set: {
          providerLeagueId: report.providerLeagueId,
          name: report.name,
          country: report.country,
          currentSeason: report.currentSeason,
          latestSeason: report.latestSeason,
          seasons: report.seasons,
          fixturesAvailable: report.fixturesAvailable,
          error: report.error,
          checkedAt: new Date(),
        },
      });
  } catch {
    sportsLog.warn('league coverage could not be stored', { leagueKey: report.leagueKey });
  }
}

export interface VerifyCoverageOptions {
  provider?: string;
  leagues?: LeagueKey[];
  /** Re-checks even when the stored reading is still inside its TTL. */
  force?: boolean;
  providerInstance?: SportsDataProvider;
}

export interface CoverageVerification {
  provider: string;
  status: 'ok' | 'cached' | 'skipped' | 'failed';
  skippedReason?: string;
  rows: LeagueCoverageRow[];
  /** Requests this verification spent. Zero when the cache answered. */
  apiRequests: number;
  quota: ProviderQuota;
  message: string;
  errors: string[];
}

/**
 * Refreshes the diagnostic, or returns the cached reading when it is current.
 *
 * Never throws. A competition that fails is reported as a failed competition;
 * the others still produce their answer, because two healthy leagues and one
 * broken one is a far more useful result than a single thrown error.
 */
export async function verifyLeagueCoverage(
  options: VerifyCoverageOptions = {},
): Promise<CoverageVerification> {
  const providerName = options.provider ?? DEFAULT_PROVIDER;
  const leagues = options.leagues?.length ? options.leagues : SUPPORTED_LEAGUE_KEYS;

  const verification: CoverageVerification = {
    provider: providerName,
    status: 'failed',
    rows: await readLeagueCoverage(providerName),
    apiRequests: 0,
    quota: await readProviderQuota(providerName),
    message: '',
    errors: [],
  };

  let provider: SportsDataProvider;
  try {
    provider = options.providerInstance ?? getProvider(providerName);
  } catch (error) {
    verification.errors.push(describeError(error));
    verification.message = describeError(error);
    return verification;
  }

  if (!provider.isConfigured()) {
    verification.status = 'skipped';
    verification.skippedReason = 'API_NOT_CONFIGURED';
    verification.message = 'No provider key is configured, so no request was attempted.';
    return verification;
  }

  // Cache first — the whole point of storing the reading is that the question
  // does not have to be re-bought every time someone opens the page.
  if (!options.force) {
    const relevant = verification.rows.filter((row) => leagues.includes(row.leagueKey as LeagueKey));
    const allFresh =
      relevant.length === leagues.length &&
      relevant.every((row) => row.checked && isFresh(row.checkedAt, CACHE_TTL_SECONDS.leagues));

    if (allFresh) {
      verification.status = 'cached';
      verification.message = 'Coverage is current; no request was made.';
      return verification;
    }
  }

  if (!canSpendQuota(verification.quota)) {
    verification.status = 'skipped';
    verification.skippedReason = 'RATE_LIMITED';
    verification.message = `The daily request allowance is spent (0 of ${verification.quota.dailyLimit ?? '?'} left); it resets at 00:00 UTC.`;
    verification.errors.push(`[RATE_LIMITED] ${verification.message}`);
    return verification;
  }

  try {
    const reports = await provider.getLeagueCoverage(leagues);
    for (const report of reports) {
      await storeCoverage(providerName, report);
      if (report.error) verification.errors.push(`${report.leagueKey}: ${report.error}`);
    }

    const healthy = reports.filter((report) => !report.error);
    verification.status = healthy.length > 0 ? 'ok' : 'failed';
    verification.message =
      healthy.length === reports.length
        ? `Checked ${reports.length} competition${reports.length === 1 ? '' : 's'} against the provider.`
        : `${healthy.length} of ${reports.length} competitions could be checked.`;
  } catch (error) {
    verification.status = 'failed';
    verification.errors.push(describeError(error));
    verification.message = describeError(error);
  }

  const report = provider.lastResponse?.() ?? null;
  if (report) await recordQuotaObservation(providerName, report);

  const usage = provider.usage();
  verification.apiRequests = usage.reduce((total, entry) => total + entry.requests, 0);
  await recordApiRequests(providerName, usage);

  verification.quota = await readProviderQuota(providerName);
  verification.rows = await readLeagueCoverage(providerName);
  return verification;
}

/**
 * How many requests a verification would cost right now.
 *
 * Shown on the button so the cost is known before it is spent, and zero while
 * the cached reading is still current.
 */
export function coverageRequestCost(
  rows: LeagueCoverageRow[],
  now: Date = new Date(),
): number {
  return rows.filter(
    (row) => !row.checked || !isFresh(row.checkedAt, CACHE_TTL_SECONDS.leagues, now),
  ).length;
}

/**
 * Whether the configured id resolved to a competition that serves fixtures.
 *
 * The single question the whole diagnostic exists to answer, so it is asked in
 * one place rather than re-derived by each caller.
 */
export function coverageVerdict(
  row: LeagueCoverageRow,
): 'UNCHECKED' | 'ERROR' | 'NO_FIXTURES' | 'OK' {
  if (!row.checked) return 'UNCHECKED';
  if (row.error) return 'ERROR';
  if (!row.fixturesAvailable) return 'NO_FIXTURES';
  return 'OK';
}

/** Coverage rows narrowed to the competitions this provider can serve. */
export function configuredCoverageKeys(provider: string = DEFAULT_PROVIDER): LeagueKey[] {
  return SUPPORTED_LEAGUE_KEYS.filter((key) => providerLeagueId(key, provider) !== null);
}

/** Kept for callers that want a single competition's stored reading. */
export async function readLeagueCoverageRow(
  leagueKey: LeagueKey,
  provider: string = DEFAULT_PROVIDER,
): Promise<LeagueCoverageRow> {
  try {
    const [row] = await db
      .select()
      .from(sportsLeagueCoverage)
      .where(
        and(
          eq(sportsLeagueCoverage.provider, provider),
          eq(sportsLeagueCoverage.leagueKey, leagueKey),
        ),
      )
      .limit(1);

    if (!row) return unchecked(leagueKey, provider);

    return {
      provider: row.provider,
      leagueKey: row.leagueKey,
      providerLeagueId: row.providerLeagueId,
      name: row.name,
      country: row.country,
      currentSeason: row.currentSeason,
      latestSeason: row.latestSeason,
      seasons: (row.seasons ?? []) as SeasonCoverage[],
      fixturesAvailable: row.fixturesAvailable,
      error: row.error,
      checkedAt: row.checkedAt,
      checked: true,
    };
  } catch {
    return unchecked(leagueKey, provider);
  }
}
