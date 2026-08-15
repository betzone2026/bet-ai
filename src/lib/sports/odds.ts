/**
 * Odds snapshot policy.
 *
 * Prices are stored append-only. A snapshot means "this book showed this price
 * from `capturedAt` until the next snapshot for the same selection", which is
 * what makes line movement, closing-line comparison and backtesting possible
 * later. Nothing in the pipeline is allowed to update a snapshot in place.
 *
 * The one compression applied is that an unchanged price is not written again:
 * re-recording the same number every five minutes adds rows without adding
 * information, and the interpretation above already covers the gap.
 *
 * Pure and dependency-free so it can be exercised directly in tests.
 */

import type { OddsSnapshot } from './types.ts';

/** Below evens is impossible; above this is a parsing accident. */
const MIN_DECIMAL_ODDS = 1.01;
const MAX_DECIMAL_ODDS = 1_000;

export function isValidDecimalOdds(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_DECIMAL_ODDS &&
    value <= MAX_DECIMAL_ODDS
  );
}

/** Identity of a price line, independent of when it was observed. */
export function oddsKey(snapshot: Pick<OddsSnapshot, 'bookmaker' | 'market' | 'selection'>): string {
  return `${snapshot.bookmaker}|${snapshot.market}|${snapshot.selection}`;
}

/** Most recent snapshot per price line, from an unordered set. */
export function latestByKey(snapshots: OddsSnapshot[]): Map<string, OddsSnapshot> {
  const latest = new Map<string, OddsSnapshot>();
  for (const snapshot of snapshots) {
    const key = oddsKey(snapshot);
    const held = latest.get(key);
    if (!held || new Date(snapshot.capturedAt) > new Date(held.capturedAt)) {
      latest.set(key, snapshot);
    }
  }
  return latest;
}

/**
 * Which incoming prices are worth appending: everything unseen, plus every line
 * whose price moved. Invalid prices are dropped rather than stored as noise.
 */
export function selectNewSnapshots(
  previous: OddsSnapshot[],
  incoming: OddsSnapshot[],
): OddsSnapshot[] {
  const latest = latestByKey(previous);
  const chosen = new Map<string, OddsSnapshot>();

  for (const snapshot of incoming) {
    if (!isValidDecimalOdds(snapshot.decimalOdds)) continue;

    const key = oddsKey(snapshot);
    const held = latest.get(key);
    if (held && held.decimalOdds === snapshot.decimalOdds) continue;

    // Two identical lines in one payload: keep the later capture only.
    const staged = chosen.get(key);
    if (staged && new Date(staged.capturedAt) >= new Date(snapshot.capturedAt)) continue;
    chosen.set(key, snapshot);
  }

  return [...chosen.values()];
}
