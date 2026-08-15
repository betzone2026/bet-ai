/**
 * Central configuration for the sports-data layer.
 *
 * Two things live here on purpose:
 *
 * 1. **League identity.** Provider league ids appear in exactly one place. A
 *    second provider adds a key to `providerIds`; no call site changes.
 * 2. **Freshness policy.** Every TTL the pipeline honours is declared together,
 *    so the cost of a sync is legible in one screen rather than scattered
 *    across services.
 */

import type { FixtureStatus } from './types.ts';

/** The provider the MVP ships with. */
export const DEFAULT_PROVIDER = 'api-football' as const;

/**
 * Short, URL-safe prefix each provider stamps onto internal ids.
 *
 * Internal ids are `<prefix>-<providerId>` (`af-1035037`). They are stable,
 * readable in a URL without escaping, and impossible to confuse with the demo
 * dataset's `dm-` ids.
 */
export const PROVIDER_ID_PREFIX: Record<string, string> = {
  'api-football': 'af',
};

/** Builds an internal id from a provider name and that provider's own id. */
export function internalId(provider: string, providerId: string | number): string {
  const prefix = PROVIDER_ID_PREFIX[provider] ?? provider;
  return `${prefix}-${providerId}`;
}

/** Recovers a provider's own id from an internal one, or `null` if it is not ours. */
export function providerIdFrom(id: string, provider: string): string | null {
  const prefix = `${PROVIDER_ID_PREFIX[provider] ?? provider}-`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
}

/** True for ids belonging to the clearly-labelled demo dataset. */
export function isDemoId(id: string): boolean {
  return id.startsWith('dm-');
}

// ---------------------------------------------------------------------------
// Supported competitions
// ---------------------------------------------------------------------------

export type LeagueKey = 'serie_a' | 'premier_league' | 'champions_league';

export interface SupportedLeague {
  key: LeagueKey;
  name: string;
  country: string;
  countryCode: string | null;
  type: 'league' | 'cup';
  /** Provider name → that provider's id for this competition. */
  providerIds: Record<string, string>;
}

/**
 * The MVP slate. Importing every competition on earth would burn the request
 * quota on fixtures nobody looks at, so the pipeline is scoped to three and
 * widened deliberately.
 */
export const SUPPORTED_LEAGUES: Record<LeagueKey, SupportedLeague> = {
  serie_a: {
    key: 'serie_a',
    name: 'Serie A',
    country: 'Italy',
    countryCode: 'IT',
    type: 'league',
    providerIds: { 'api-football': '135' },
  },
  premier_league: {
    key: 'premier_league',
    name: 'Premier League',
    country: 'England',
    countryCode: 'GB',
    type: 'league',
    providerIds: { 'api-football': '39' },
  },
  champions_league: {
    key: 'champions_league',
    name: 'UEFA Champions League',
    country: 'World',
    countryCode: null,
    type: 'cup',
    providerIds: { 'api-football': '2' },
  },
};

export const SUPPORTED_LEAGUE_KEYS = Object.keys(SUPPORTED_LEAGUES) as LeagueKey[];

/** Narrows an arbitrary value to a configured league key. */
export function isLeagueKey(value: unknown): value is LeagueKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SUPPORTED_LEAGUES, value);
}

/** The provider's id for a competition, or `null` if that provider lacks it. */
export function providerLeagueId(key: LeagueKey, provider: string): string | null {
  return SUPPORTED_LEAGUES[key].providerIds[provider] ?? null;
}

/** Reverse lookup: which configured competition is this provider id? */
export function leagueKeyForProviderId(provider: string, providerId: string): LeagueKey | null {
  for (const key of SUPPORTED_LEAGUE_KEYS) {
    if (SUPPORTED_LEAGUES[key].providerIds[provider] === String(providerId)) return key;
  }
  return null;
}

/**
 * European season label for a date: 2025/26 is reported as `2025`.
 *
 * The cut-over is 1 July — late enough that the previous season's play-offs
 * still resolve to their own year, early enough for pre-season fixtures.
 */
export function seasonForDate(date: Date): number {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 6 ? year : year - 1;
}

// ---------------------------------------------------------------------------
// Cache / TTL policy
// ---------------------------------------------------------------------------

/**
 * How long each kind of record stays usable before the pipeline should ask the
 * provider again. Values are seconds.
 *
 * These are the only numbers that govern request volume, so they are tuned
 * against what actually changes: a league's name does not, a live score does.
 */
export const CACHE_TTL_SECONDS = {
  /** Competition metadata barely moves. */
  leagues: 24 * 60 * 60,
  /** Tables settle once a round finishes. */
  standings: 45 * 60,
  /** Fixtures kicking off in more than 24h: only lineups/venues drift. */
  fixturesFuture: 6 * 60 * 60,
  /** Fixtures inside the next 24h. */
  fixturesSoon: 60 * 60,
  /** Today's slate — kickoff times and postponements move late. */
  fixturesToday: 10 * 60,
  /**
   * In-play refresh. Nothing reads this yet: live polling stays off until the
   * live feature is deliberately enabled, because it is the single most
   * expensive thing the quota can be spent on.
   */
  fixturesLive: 45,
  /** A finished match's statistics never change again. */
  statisticsCompleted: 30 * 24 * 60 * 60,
  /** Statistics for a match still in progress. */
  statisticsLive: 2 * 60,
  lineups: 15 * 60,
  injuries: 6 * 60 * 60,
  /** Prices move constantly; short TTL, and every read is archived. */
  odds: 5 * 60,
} as const;

export type CacheKind = keyof typeof CACHE_TTL_SECONDS;

/**
 * TTL for a specific fixture, chosen from how close it is to kicking off.
 *
 * A fixture three weeks out and a fixture starting in an hour are the same row
 * with wildly different volatility; one TTL for both would either waste
 * requests or serve stale kickoff times.
 */
export function fixtureTtlSeconds(
  kickoff: Date,
  status: FixtureStatus,
  now: Date = new Date(),
): number {
  if (status === 'live') return CACHE_TTL_SECONDS.fixturesLive;
  if (status === 'finished') return CACHE_TTL_SECONDS.statisticsCompleted;

  const msUntilKickoff = kickoff.getTime() - now.getTime();
  if (msUntilKickoff < 0) return CACHE_TTL_SECONDS.fixturesToday;
  if (msUntilKickoff <= 12 * 60 * 60 * 1000) return CACHE_TTL_SECONDS.fixturesToday;
  if (msUntilKickoff <= 24 * 60 * 60 * 1000) return CACHE_TTL_SECONDS.fixturesSoon;
  return CACHE_TTL_SECONDS.fixturesFuture;
}

/**
 * Whether a record written at `updatedAt` is still inside its TTL.
 *
 * This is the guard that sits in front of every provider call: if the answer is
 * yes, the request is not made at all.
 */
export function isFresh(
  updatedAt: Date | string | null | undefined,
  ttlSeconds: number,
  now: Date = new Date(),
): boolean {
  if (!updatedAt) return false;
  const written = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const age = now.getTime() - written.getTime();
  if (!Number.isFinite(age)) return false;
  // A timestamp from the future is a clock problem, not freshness.
  if (age < 0) return true;
  return age < ttlSeconds * 1000;
}

// ---------------------------------------------------------------------------
// Request hygiene
// ---------------------------------------------------------------------------

/** Hard ceiling on a single provider HTTP call. */
export const PROVIDER_TIMEOUT_MS = 12_000;

/**
 * Ceiling on stored error text.
 *
 * Raw provider payloads are deliberately *not* persisted: a season of fixture
 * JSON would dwarf the rest of the database and none of it is queryable. Sync
 * runs keep a truncated summary, which is what an operator actually reads.
 */
export const MAX_ERROR_SUMMARY_CHARS = 2_000;

/** Upper bound on fixtures accepted from one sync, as a runaway guard. */
export const MAX_FIXTURES_PER_SYNC = 500;
