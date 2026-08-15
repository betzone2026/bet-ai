/**
 * Validation, duplicate detection and data-quality grading.
 *
 * These are the rules that decide what reaches the database. They are pure
 * functions over normalised models, so the suite needs neither a provider nor a
 * connection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessFixtureQuality,
  dedupeFixtureBundles,
  isPlausibleScore,
  isValidKickoff,
  statusForIssues,
  validateFixtureBundle,
} from '../src/lib/sports/quality.ts';
import type { FixtureBundle } from '../src/lib/sports/types.ts';

const NOW = new Date('2026-08-15T12:00:00.000Z');

function bundle(overrides: Partial<FixtureBundle['fixture']> = {}): FixtureBundle {
  return {
    fixture: {
      id: 'af-1',
      provider: 'api-football',
      providerId: '1',
      leagueId: 'af-135',
      season: 2026,
      homeTeamId: 'af-497',
      awayTeamId: 'af-505',
      kickoff: '2026-08-22T18:45:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      elapsed: null,
      homeScore: null,
      awayScore: null,
      venue: null,
      referee: null,
      round: null,
      updatedAt: NOW.toISOString(),
      ...overrides,
    },
    league: {
      id: 'af-135',
      provider: 'api-football',
      providerId: '135',
      name: 'Serie A',
      country: 'Italy',
      countryCode: 'IT',
      logoUrl: null,
      type: 'league',
      active: true,
      slug: 'serie_a',
    },
    season: null,
    homeTeam: {
      id: 'af-497', provider: 'api-football', providerId: '497', name: 'AS Roma',
      code: null, country: null, logoUrl: null, founded: null, venueName: null,
    },
    awayTeam: {
      id: 'af-505', provider: 'api-football', providerId: '505', name: 'Inter',
      code: null, country: null, logoUrl: null, founded: null, venueName: null,
    },
  };
}

describe('primitive checks', () => {
  it('accepts a kickoff within the plausible window', () => {
    assert.equal(isValidKickoff('2026-08-22T18:45:00.000Z', NOW), true);
    assert.equal(isValidKickoff('2025-03-01T15:00:00.000Z', NOW), true);
  });

  it('rejects an unparseable or absurdly distant kickoff', () => {
    assert.equal(isValidKickoff('tomorrow', NOW), false);
    assert.equal(isValidKickoff('2199-01-01T00:00:00.000Z', NOW), false);
  });

  it('accepts a null score but not an impossible one', () => {
    assert.equal(isPlausibleScore(null, null), true);
    assert.equal(isPlausibleScore(3, 0), true);
    assert.equal(isPlausibleScore(-1, 0), false);
    assert.equal(isPlausibleScore(0, 99), false);
    assert.equal(isPlausibleScore(1.5, 0), false);
  });

  it('lets the worst issue decide the grade', () => {
    assert.equal(statusForIssues([]), 'GOOD');
    assert.equal(statusForIssues(['missing_odds']), 'PARTIAL');
    assert.equal(statusForIssues(['stale_statistics']), 'STALE');
    assert.equal(statusForIssues(['missing_odds', 'invalid_kickoff']), 'INVALID');
  });
});

describe('fixture validation', () => {
  it('passes a complete fixture', () => {
    const report = validateFixtureBundle(bundle(), NOW);
    assert.equal(report.status, 'GOOD');
    assert.deepEqual(report.issues, []);
  });

  it('rejects a fixture whose kickoff cannot be read', () => {
    const report = validateFixtureBundle(bundle({ kickoff: 'not-a-date' }), NOW);
    assert.equal(report.status, 'INVALID');
    assert.ok(report.issues.includes('invalid_kickoff'));
  });

  it('rejects an impossible score', () => {
    const report = validateFixtureBundle(bundle({ homeScore: 61, awayScore: 0 }), NOW);
    assert.equal(report.status, 'INVALID');
    assert.ok(report.issues.includes('impossible_score'));
  });

  it('rejects a fixture where a team plays itself', () => {
    const invalid = bundle();
    invalid.awayTeam = { ...invalid.homeTeam };
    invalid.fixture.awayTeamId = invalid.fixture.homeTeamId;
    const report = validateFixtureBundle(invalid, NOW);
    assert.equal(report.status, 'INVALID');
    assert.ok(report.issues.includes('missing_teams'));
  });

  it('rejects a fixture with no league identity', () => {
    const invalid = bundle();
    invalid.league = { ...invalid.league, name: '' };
    const report = validateFixtureBundle(invalid, NOW);
    assert.equal(report.status, 'INVALID');
    assert.ok(report.issues.includes('missing_league'));
  });
});

describe('duplicate prevention', () => {
  it('keeps one fixture per provider id', () => {
    const first = bundle();
    const duplicate = bundle();
    const other = bundle({ id: 'af-2', providerId: '2' });

    const { unique, duplicates } = dedupeFixtureBundles([first, duplicate, other]);
    assert.equal(unique.length, 2);
    assert.equal(duplicates.length, 1);
    assert.deepEqual(unique.map((entry) => entry.fixture.providerId).sort(), ['1', '2']);
  });

  it('treats the same id from different providers as different fixtures', () => {
    const a = bundle();
    const b = bundle();
    b.fixture = { ...b.fixture, provider: 'sportmonks' };

    const { unique, duplicates } = dedupeFixtureBundles([a, b]);
    assert.equal(unique.length, 2);
    assert.equal(duplicates.length, 0);
  });
});

describe('data quality grading', () => {
  it('grades a complete finished fixture as GOOD', () => {
    const report = assessFixtureQuality({
      fixture: { status: 'finished', kickoff: '2026-08-14T18:45:00.000Z' },
      hasStatistics: true,
      hasOdds: true,
      statisticsUpdatedAt: NOW,
      statisticsTtlSeconds: 2_592_000,
      now: NOW,
    });
    assert.equal(report.status, 'GOOD');
  });

  it('flags a finished fixture with no statistics', () => {
    const report = assessFixtureQuality({
      fixture: { status: 'finished', kickoff: '2026-08-14T18:45:00.000Z' },
      hasStatistics: false,
      hasOdds: true,
      statisticsTtlSeconds: 2_592_000,
      now: NOW,
    });
    assert.ok(report.issues.includes('missing_statistics'));
    assert.equal(report.status, 'PARTIAL');
  });

  it('does not expect statistics for a fixture that has not kicked off', () => {
    const report = assessFixtureQuality({
      fixture: { status: 'scheduled', kickoff: '2026-08-22T18:45:00.000Z' },
      hasStatistics: false,
      hasOdds: true,
      statisticsTtlSeconds: 600,
      now: NOW,
    });
    assert.ok(!report.issues.includes('missing_statistics'));
  });

  it('marks statistics older than their refresh window as STALE', () => {
    const report = assessFixtureQuality({
      fixture: { status: 'live', kickoff: '2026-08-15T11:00:00.000Z' },
      hasStatistics: true,
      hasOdds: false,
      statisticsUpdatedAt: new Date(NOW.getTime() - 3_600_000),
      statisticsTtlSeconds: 120,
      now: NOW,
    });
    assert.equal(report.status, 'STALE');
    assert.ok(report.issues.includes('stale_statistics'));
  });

  it('carries structural issues through to the final grade', () => {
    const report = assessFixtureQuality({
      fixture: { status: 'scheduled', kickoff: '2026-08-22T18:45:00.000Z' },
      hasStatistics: false,
      hasOdds: true,
      baseIssues: ['invalid_kickoff'],
      statisticsTtlSeconds: 600,
      now: NOW,
    });
    assert.equal(report.status, 'INVALID');
  });
});
