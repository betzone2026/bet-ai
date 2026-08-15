/**
 * Wording for the two ways a fixture fetch comes back empty.
 *
 * "0 fixtures" is the least useful sentence the admin screen could print,
 * because it collapses two unrelated situations into one number:
 *
 *   - the provider had nothing to send (no football was played that day), and
 *   - the provider sent plenty and our league filter matched none of it.
 *
 * The first is fine and needs no action. The second means the configured
 * provider league ids are wrong, and every sync until they are fixed will
 * import nothing while reporting success. Telling them apart is the whole point
 * of tracking `providerReturned` separately from `matched`, so the distinction
 * is made once, here, and reused by the preview, the sync and the API.
 */

import { DEFAULT_PROVIDER } from './config.ts';

/** Human-facing provider names. The wire name (`api-football`) is not one. */
const PROVIDER_LABELS: Record<string, string> = {
  'api-football': 'API-Football',
};

export function providerLabel(provider: string = DEFAULT_PROVIDER): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Which of the three outcomes a fetch produced.
 *
 * `EMPTY_PROVIDER` and `NO_MATCH` are both "zero fixtures imported" and are
 * never merged: the operator's next move differs completely.
 */
export type FixtureOutcome = 'EMPTY_PROVIDER' | 'NO_MATCH' | 'MATCHED';

export function fixtureOutcome(providerReturned: number, matched: number): FixtureOutcome {
  if (providerReturned <= 0) return 'EMPTY_PROVIDER';
  if (matched <= 0) return 'NO_MATCH';
  return 'MATCHED';
}

/**
 * The sentence to show for a fetch, given both counts.
 *
 * `date` is included on the empty case because an admin who mistyped the date
 * is the most likely reader of it.
 */
export function describeFixtureOutcome(input: {
  providerReturned: number;
  matched: number;
  date?: string;
  provider?: string;
}): string {
  const outcome = fixtureOutcome(input.providerReturned, input.matched);
  const label = providerLabel(input.provider);

  if (outcome === 'EMPTY_PROVIDER') {
    return input.date
      ? `No fixtures were returned by ${label} for ${input.date}.`
      : `No fixtures were returned by ${label} for this date.`;
  }

  if (outcome === 'NO_MATCH') {
    return `Provider returned fixtures, but none matched the configured competitions. ${label} returned ${input.providerReturned} fixture${input.providerReturned === 1 ? '' : 's'} across other competitions.`;
  }

  return `Provider returned: ${input.providerReturned} · SportAlpha matched: ${input.matched}`;
}

/** The compact debug line the admin panel shows under every fetch. */
export function debugCountsLine(providerReturned: number, matched: number): string {
  return `Provider returned: ${providerReturned} · SportAlpha matched: ${matched}`;
}

/** `1 API request` / `3 API requests`, so the cost is never ambiguous. */
export function describeRequestCost(requests: number): string {
  return `${requests} API request${requests === 1 ? '' : 's'}`;
}
