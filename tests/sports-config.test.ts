/**
 * Central configuration: league identity, id conventions and refresh policy.
 *
 * The point of pinning these down is that every other module trusts them. If
 * `internalId` and `providerIdFrom` ever stop being inverses, ids silently stop
 * resolving; if a league id changes, the pipeline imports the wrong
 * competition without failing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CACHE_TTL_SECONDS,
  DEFAULT_PROVIDER,
  SUPPORTED_LEAGUES,
  SUPPORTED_LEAGUE_KEYS,
  fixtureTtlSeconds,
  internalId,
  isDemoId,
  isFresh,
  isLeagueKey,
  leagueKeyForProviderId,
  providerIdFrom,
  providerLeagueId,
  seasonForDate,
} from '../src/lib/sports/config.ts';

describe('supported competitions', () => {
  it('covers exactly the three competitions of the MVP slate', () => {
    assert.deepEqual([...SUPPORTED_LEAGUE_KEYS].sort(), [
      'champions_league',
      'premier_league',
      'serie_a',
    ]);
  });

  it('resolves each competition to its provider id in one place', () => {
    assert.equal(providerLeagueId('serie_a', DEFAULT_PROVIDER), '135');
    assert.equal(providerLeagueId('premier_league', DEFAULT_PROVIDER), '39');
    assert.equal(providerLeagueId('champions_league', DEFAULT_PROVIDER), '2');
  });

  it('maps a provider id back to the SportAlpha key', () => {
    assert.equal(leagueKeyForProviderId(DEFAULT_PROVIDER, '135'), 'serie_a');
    assert.equal(leagueKeyForProviderId(DEFAULT_PROVIDER, '61'), null, 'Ligue 1 is not covered');
  });

  it('returns null for a provider that has no id for a competition', () => {
    assert.equal(providerLeagueId('serie_a', 'sportmonks'), null);
  });

  it('recognises a league key at runtime', () => {
    assert.equal(isLeagueKey('serie_a'), true);
    assert.equal(isLeagueKey('la_liga'), false);
    assert.equal(isLeagueKey(42), false);
  });

  it('names every competition it covers', () => {
    for (const key of SUPPORTED_LEAGUE_KEYS) {
      assert.ok(SUPPORTED_LEAGUES[key].name.length > 0);
      assert.equal(SUPPORTED_LEAGUES[key].key, key);
    }
  });
});

describe('internal identifiers', () => {
  it('prefixes a provider id so its origin stays readable', () => {
    assert.equal(internalId('api-football', 1035037), 'af-1035037');
    assert.equal(internalId('api-football', '135'), 'af-135');
  });

  it('round-trips back to the provider id', () => {
    const id = internalId('api-football', 1035037);
    assert.equal(providerIdFrom(id, 'api-football'), '1035037');
  });

  it('refuses to read an id belonging to another source', () => {
    assert.equal(providerIdFrom('dm-001', 'api-football'), null);
    assert.equal(providerIdFrom('sm-999', 'api-football'), null);
  });

  it('separates demo ids from imported ones', () => {
    assert.equal(isDemoId('dm-001'), true);
    assert.equal(isDemoId('af-1035037'), false);
  });
});

describe('season resolution', () => {
  it('assigns the season by its starting year', () => {
    assert.equal(seasonForDate(new Date('2026-08-22T00:00:00.000Z')), 2026);
    assert.equal(seasonForDate(new Date('2026-12-31T00:00:00.000Z')), 2026);
    assert.equal(seasonForDate(new Date('2027-02-14T00:00:00.000Z')), 2026, 'February belongs to the season that began the previous August');
    assert.equal(seasonForDate(new Date('2026-05-30T00:00:00.000Z')), 2025);
  });
});

describe('refresh policy', () => {
  const now = new Date('2026-08-15T12:00:00.000Z');

  it('refreshes a live match far more often than a distant one', () => {
    const live = fixtureTtlSeconds(new Date('2026-08-15T11:30:00.000Z'), 'live', now);
    const soon = fixtureTtlSeconds(new Date('2026-08-15T20:00:00.000Z'), 'scheduled', now);
    const distant = fixtureTtlSeconds(new Date('2026-09-30T20:00:00.000Z'), 'scheduled', now);

    assert.ok(live < soon, 'a live match goes stale in seconds');
    assert.ok(soon < distant, 'a fixture next month barely changes');
    assert.equal(live, CACHE_TTL_SECONDS.fixturesLive);
  });

  it('treats a finished match as effectively settled', () => {
    const finished = fixtureTtlSeconds(new Date('2026-08-14T20:00:00.000Z'), 'finished', now);
    assert.ok(finished >= CACHE_TTL_SECONDS.fixturesFuture);
  });

  it('answers whether stored data is still inside its window', () => {
    assert.equal(isFresh(new Date(now.getTime() - 60_000), 600, now), true);
    assert.equal(isFresh(new Date(now.getTime() - 3_600_000), 600, now), false);
    assert.equal(isFresh(null, 600, now), false, 'never written means never fresh');
  });
});
