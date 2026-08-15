/**
 * Validation and data-quality grading.
 *
 * The pipeline is deliberately permissive: a fixture with a missing statistic
 * is still worth storing, because the kickoff, the teams and the result are
 * all correct. What it must never do is let an incomplete row look complete —
 * so everything that is not `GOOD` carries the reasons why, and the future
 * Quant Engine can filter on them instead of silently modelling holes.
 *
 * Pure and dependency-free so it can be exercised directly in tests.
 */

import type {
  DataQualityIssue,
  DataQualityReport,
  DataQualityStatus,
  Fixture,
  FixtureBundle,
} from './types.ts';

/** Above this, a scoreline is a parsing bug rather than a football result. */
const MAX_PLAUSIBLE_GOALS = 30;

/** Fixtures more than this far from now indicate a bad kickoff timestamp. */
const MAX_KICKOFF_DRIFT_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/** Issues that make a record unusable rather than merely incomplete. */
const FATAL_ISSUES: ReadonlySet<DataQualityIssue> = new Set([
  'missing_teams',
  'missing_league',
  'invalid_kickoff',
  'impossible_score',
  'duplicate_fixture',
]);

export function isValidKickoff(kickoff: string, now: Date = new Date()): boolean {
  const at = new Date(kickoff);
  const ms = at.getTime();
  if (!Number.isFinite(ms)) return false;
  return Math.abs(ms - now.getTime()) <= MAX_KICKOFF_DRIFT_MS;
}

export function isPlausibleScore(home: number | null, away: number | null): boolean {
  for (const score of [home, away]) {
    if (score === null) continue;
    if (!Number.isInteger(score) || score < 0 || score > MAX_PLAUSIBLE_GOALS) return false;
  }
  return true;
}

/** Grades a set of issues. The worst issue decides the status. */
export function statusForIssues(issues: DataQualityIssue[]): DataQualityStatus {
  if (issues.some((issue) => FATAL_ISSUES.has(issue))) return 'INVALID';
  if (issues.includes('stale_statistics')) return 'STALE';
  return issues.length > 0 ? 'PARTIAL' : 'GOOD';
}

/**
 * Structural check on a freshly normalised fixture: does it have the things a
 * fixture cannot exist without?
 */
export function validateFixtureBundle(
  bundle: FixtureBundle,
  now: Date = new Date(),
): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const { fixture, league, homeTeam, awayTeam } = bundle;

  if (!league.id || !league.name) issues.push('missing_league');
  if (!homeTeam.id || !awayTeam.id || !homeTeam.name || !awayTeam.name || homeTeam.id === awayTeam.id) {
    issues.push('missing_teams');
  }
  if (!isValidKickoff(fixture.kickoff, now)) issues.push('invalid_kickoff');
  if (!isPlausibleScore(fixture.homeScore, fixture.awayScore)) issues.push('impossible_score');

  return { status: statusForIssues(issues), issues };
}

export interface FixtureCompletenessInput {
  fixture: Pick<Fixture, 'status' | 'kickoff'>;
  hasStatistics: boolean;
  hasOdds: boolean;
  /** When the statistics row was last written, if there is one. */
  statisticsUpdatedAt?: Date | string | null;
  /** Structural issues already found for this fixture. */
  baseIssues?: DataQualityIssue[];
  statisticsTtlSeconds: number;
  now?: Date;
}

/**
 * Full grade for a stored fixture: structure plus the surrounding data the
 * Quant Engine will want.
 *
 * Missing odds on a fixture kicking off next month is normal; missing
 * statistics on a match that finished is not. The checks are conditioned on
 * lifecycle so the flag means something.
 */
export function assessFixtureQuality(input: FixtureCompletenessInput): DataQualityReport {
  const now = input.now ?? new Date();
  const issues: DataQualityIssue[] = [...(input.baseIssues ?? [])];

  const finished = input.fixture.status === 'finished';
  if (finished && !input.hasStatistics) issues.push('missing_statistics');

  if (input.hasStatistics && input.statisticsUpdatedAt) {
    const writtenAt = new Date(input.statisticsUpdatedAt);
    const age = now.getTime() - writtenAt.getTime();
    if (Number.isFinite(age) && age > input.statisticsTtlSeconds * 1000) {
      issues.push('stale_statistics');
    }
  }

  // Odds are only expected once a fixture is close enough for books to price it.
  const kickoffMs = new Date(input.fixture.kickoff).getTime();
  const withinPricingWindow =
    Number.isFinite(kickoffMs) && kickoffMs - now.getTime() <= 48 * 60 * 60 * 1000;
  if (!input.hasOdds && withinPricingWindow && input.fixture.status === 'scheduled') {
    issues.push('missing_odds');
  }

  return { status: statusForIssues(dedupeIssues(issues)), issues: dedupeIssues(issues) };
}

function dedupeIssues(issues: DataQualityIssue[]): DataQualityIssue[] {
  return [...new Set(issues)];
}

export interface DedupeResult {
  unique: FixtureBundle[];
  duplicates: FixtureBundle[];
}

/**
 * Collapses repeated fixtures within one provider response.
 *
 * Feeds do occasionally return the same fixture twice — a competition listed
 * under two league ids, or overlapping date windows. The database unique
 * constraint would reject the second write anyway; catching it here keeps the
 * sync summary honest about how many records were really new.
 */
export function dedupeFixtureBundles(bundles: FixtureBundle[]): DedupeResult {
  const seen = new Set<string>();
  const unique: FixtureBundle[] = [];
  const duplicates: FixtureBundle[] = [];

  for (const bundle of bundles) {
    const key = `${bundle.fixture.provider}:${bundle.fixture.providerId}`;
    if (seen.has(key)) {
      duplicates.push(bundle);
      continue;
    }
    seen.add(key);
    unique.push(bundle);
  }

  return { unique, duplicates };
}
