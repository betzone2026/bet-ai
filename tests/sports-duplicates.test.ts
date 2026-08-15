/**
 * Duplicate prevention for repeated syncs.
 *
 * The unique key on `(provider, provider_id)` already makes a second import of
 * the same day impossible to duplicate. What is asserted here is the part that
 * is easy to get wrong and invisible when it is: a re-sync of an unchanged day
 * must report those fixtures as *unchanged*, not rewrite them and call them
 * updated. Otherwise the sync history cannot distinguish a day that gained
 * scores from a day that gained nothing.
 *
 * The comparator is free of database imports, so this runs without a connection
 * and without touching the provider.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fixtureUnchanged,
  partitionFixtures,
  type IncomingFixture,
  type StoredFixtureComparable,
} from '../src/lib/sports/diff.ts';
import type { Fixture } from '../src/lib/sports/types.ts';

function incoming(overrides: Partial<Fixture> = {}, id = 'af-1035037'): IncomingFixture {
  return {
    fixture: {
      id,
      provider: 'api-football',
      providerId: id.replace('af-', ''),
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
      venue: 'Stadio Olimpico',
      referee: 'Daniele Orsato',
      round: 'Regular Season - 1',
      updatedAt: '2026-08-15T09:00:00.000Z',
      ...overrides,
    },
    quality: 'GOOD',
    issues: [],
  };
}

function stored(overrides: Partial<StoredFixtureComparable> = {}): StoredFixtureComparable {
  return {
    leagueId: 'af-135',
    season: 2026,
    homeTeamId: 'af-497',
    awayTeamId: 'af-505',
    kickoff: new Date('2026-08-22T18:45:00.000Z'),
    timezone: 'UTC',
    status: 'scheduled',
    elapsed: null,
    homeScore: null,
    awayScore: null,
    venue: 'Stadio Olimpico',
    referee: 'Daniele Orsato',
    round: 'Regular Season - 1',
    dataQuality: 'GOOD',
    qualityIssues: [],
    ...overrides,
  };
}

describe('duplicate fixture sync', () => {
  it('inserts every fixture the first time the date is synced', () => {
    const batch = [incoming({}, 'af-1'), incoming({}, 'af-2'), incoming({}, 'af-3')];

    const partition = partitionFixtures(batch, new Map());

    assert.equal(partition.inserted, 3);
    assert.equal(partition.updated, 0);
    assert.equal(partition.unchanged, 0);
    assert.equal(partition.write.length, 3);
  });

  it('writes nothing the second time the same date is synced', () => {
    const batch = [incoming({}, 'af-1'), incoming({}, 'af-2')];
    const existing = new Map([
      ['af-1', stored()],
      ['af-2', stored()],
    ]);

    const partition = partitionFixtures(batch, existing);

    assert.equal(partition.inserted, 0);
    assert.equal(partition.updated, 0);
    assert.equal(partition.unchanged, 2);
    assert.equal(partition.write.length, 0, 'an unchanged row must not be rewritten');
  });

  it('separates the fixtures that moved from the ones that did not', () => {
    const batch = [
      incoming({}, 'af-1'),
      incoming({ status: 'finished', homeScore: 2, awayScore: 1, elapsed: 90 }, 'af-2'),
      incoming({}, 'af-3'),
    ];
    const existing = new Map([
      ['af-1', stored()],
      ['af-2', stored()],
    ]);

    const partition = partitionFixtures(batch, existing);

    assert.equal(partition.inserted, 1, 'af-3 is new');
    assert.equal(partition.updated, 1, 'af-2 gained a score');
    assert.equal(partition.unchanged, 1, 'af-1 is untouched');
    assert.deepEqual(
      partition.write.map((row) => row.fixture.id).sort(),
      ['af-2', 'af-3'],
    );
  });

  it('collapses a fixture the provider sent twice in one response', () => {
    // Postgres rejects an INSERT ... ON CONFLICT that touches the same key
    // twice, so the batch is de-duplicated before it reaches the statement.
    const batch = [incoming({}, 'af-1'), incoming({ homeScore: 1 }, 'af-1')];

    const partition = partitionFixtures(batch, new Map());

    assert.equal(partition.write.length, 1);
    assert.equal(partition.inserted, 1);
    // The last sighting wins, since it is the more recent reading.
    assert.equal(partition.write[0]?.fixture.homeScore, 1);
  });
});

describe('change detection', () => {
  it('treats a fixture with no stored counterpart as changed', () => {
    assert.equal(fixtureUnchanged(incoming(), undefined), false);
  });

  it('reads an identical fixture as unchanged whatever the kickoff type', () => {
    assert.equal(fixtureUnchanged(incoming(), stored()), true);
    assert.equal(
      fixtureUnchanged(incoming(), stored({ kickoff: '2026-08-22T18:45:00.000Z' })),
      true,
    );
  });

  it('detects the fields a re-sync exists to pick up', () => {
    assert.equal(fixtureUnchanged(incoming({ status: 'finished' }), stored()), false);
    assert.equal(fixtureUnchanged(incoming({ homeScore: 1 }), stored()), false);
    assert.equal(fixtureUnchanged(incoming({ awayScore: 0 }), stored()), false);
    assert.equal(fixtureUnchanged(incoming({ elapsed: 45 }), stored()), false);
    assert.equal(
      fixtureUnchanged(incoming({ kickoff: '2026-08-22T20:45:00.000Z' }), stored()),
      false,
    );
    assert.equal(fixtureUnchanged(incoming({ season: 2027 }), stored()), false);
  });

  it('does not mistake an omitted field for a cleared one', () => {
    // The upsert coalesces these, so a thin payload keeps what is stored. A
    // comparator that called that a change would rewrite the row every sync.
    assert.equal(fixtureUnchanged(incoming({ venue: null }), stored()), true);
    assert.equal(fixtureUnchanged(incoming({ referee: null }), stored()), true);
    assert.equal(fixtureUnchanged(incoming({ round: null }), stored()), true);
    // A different value is still a change.
    assert.equal(fixtureUnchanged(incoming({ venue: 'Elsewhere' }), stored()), false);
  });

  it('notices a change in the quality verdict', () => {
    const degraded: IncomingFixture = { ...incoming(), quality: 'PARTIAL', issues: ['missing_statistics'] };
    assert.equal(fixtureUnchanged(degraded, stored()), false);
    assert.equal(
      fixtureUnchanged(degraded, stored({ dataQuality: 'PARTIAL', qualityIssues: ['missing_statistics'] })),
      true,
    );
  });
});
