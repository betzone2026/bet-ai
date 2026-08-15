/**
 * Change detection for fixtures already in the database.
 *
 * Syncing the same date twice must not create duplicates — the unique key on
 * `(provider, provider_id)` guarantees that much. But an upsert that rewrites
 * every row also reports every row as "updated", which makes the sync history
 * useless: the second run of an unchanged day looks identical to a run that
 * genuinely imported new scores.
 *
 * So the comparison is done before the write. Rows that would not change are
 * counted as `unchanged` and left alone, which keeps `updated_at` honest and
 * turns a repeated sync into a cheap no-op instead of a full rewrite.
 *
 * This module is deliberately free of database imports so the rule can be
 * tested without a connection.
 */

import type { DataQualityIssue, DataQualityStatus, Fixture } from './types.ts';

/** The stored shape this comparison reads. A subset of the fixtures table. */
export interface StoredFixtureComparable {
  leagueId: string;
  season: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: Date | string;
  timezone: string | null;
  status: string;
  elapsed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  referee: string | null;
  round: string | null;
  dataQuality: DataQualityStatus;
  qualityIssues: DataQualityIssue[];
}

export interface IncomingFixture {
  fixture: Fixture;
  quality: DataQualityStatus;
  issues: DataQualityIssue[];
}

function sameInstant(a: Date | string, b: Date | string): boolean {
  const left = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const right = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return left === right;
}

/**
 * Fields the write coalesces: a null arriving from a thin payload keeps
 * whatever is stored, so a null incoming value can never be a change.
 */
function coalescedSame(incoming: string | null, stored: string | null): boolean {
  return incoming === null || incoming === stored;
}

function sameIssues(a: DataQualityIssue[], b: DataQualityIssue[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((issue, index) => issue === sortedB[index]);
}

/**
 * True when writing `incoming` over `stored` would change nothing.
 *
 * Scores, status and kickoff are compared strictly — those are the fields a
 * re-sync exists to pick up. Venue, referee and round are compared through the
 * same coalesce rule the upsert uses, so a fixtures payload that omits them is
 * not mistaken for a payload that cleared them.
 */
export function fixtureUnchanged(
  incoming: IncomingFixture,
  stored: StoredFixtureComparable | undefined,
): boolean {
  if (!stored) return false;
  const f = incoming.fixture;

  return (
    f.leagueId === stored.leagueId &&
    f.season === stored.season &&
    f.homeTeamId === stored.homeTeamId &&
    f.awayTeamId === stored.awayTeamId &&
    sameInstant(f.kickoff, stored.kickoff) &&
    f.timezone === stored.timezone &&
    f.status === stored.status &&
    f.elapsed === stored.elapsed &&
    f.homeScore === stored.homeScore &&
    f.awayScore === stored.awayScore &&
    coalescedSame(f.venue, stored.venue) &&
    coalescedSame(f.referee, stored.referee) &&
    coalescedSame(f.round, stored.round) &&
    incoming.quality === stored.dataQuality &&
    sameIssues(incoming.issues, stored.qualityIssues)
  );
}

export interface FixturePartition {
  /** Rows to write: new ones plus those whose content actually moved. */
  write: IncomingFixture[];
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Splits a batch against what is already stored.
 *
 * De-duplicates by internal id first — the provider can report the same fixture
 * twice inside one response, and Postgres rejects a statement that touches the
 * same key twice in a single `INSERT ... ON CONFLICT`.
 */
export function partitionFixtures(
  incoming: IncomingFixture[],
  stored: Map<string, StoredFixtureComparable>,
): FixturePartition {
  const unique = [...new Map(incoming.map((row) => [row.fixture.id, row])).values()];

  const write: IncomingFixture[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of unique) {
    const existing = stored.get(row.fixture.id);
    if (!existing) {
      inserted += 1;
      write.push(row);
      continue;
    }
    if (fixtureUnchanged(row, existing)) {
      unchanged += 1;
      continue;
    }
    updated += 1;
    write.push(row);
  }

  return { write, inserted, updated, unchanged };
}
