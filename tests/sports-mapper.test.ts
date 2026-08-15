/**
 * Mapping rules for the API-Football adapter.
 *
 * These run against fixed payloads and never touch the network — the client is
 * exercised separately with an injected `fetch`. What is asserted here is the
 * one property the Quant Engine depends on: a value the provider did not send
 * is stored as `null`, not as a plausible substitute.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyTeamStatistics,
  mapFixtureBundle,
  mapFixtureStatistics,
  mapFixtureStatus,
  mapInjury,
  mapLeague,
  mapLineup,
  mapOdds,
  mapStandings,
  mapTeam,
} from '../src/lib/sports/providers/api-football/mapper.ts';

const OBSERVED_AT = new Date('2026-08-15T12:00:00.000Z');

function fixtureEntry(overrides: Record<string, unknown> = {}) {
  return {
    fixture: {
      id: 1035037,
      referee: 'Daniele Orsato',
      timezone: 'UTC',
      date: '2026-08-22T18:45:00+00:00',
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
      venue: { id: 907, name: 'Stadio Olimpico', city: 'Roma' },
    },
    league: {
      id: 135,
      name: 'Serie A',
      country: 'Italy',
      logo: 'https://media.api-sports.io/football/leagues/135.png',
      season: 2026,
      round: 'Regular Season - 1',
    },
    teams: {
      home: { id: 497, name: 'AS Roma', logo: 'https://media.api-sports.io/football/teams/497.png' },
      away: { id: 505, name: 'Inter', logo: 'https://media.api-sports.io/football/teams/505.png' },
    },
    goals: { home: 2, away: 1 },
    ...overrides,
  };
}

describe('fixture status mapping', () => {
  it('collapses provider codes onto the SportAlpha lifecycle', () => {
    assert.equal(mapFixtureStatus('NS'), 'scheduled');
    assert.equal(mapFixtureStatus('1H'), 'live');
    assert.equal(mapFixtureStatus('HT'), 'live');
    assert.equal(mapFixtureStatus('FT'), 'finished');
    assert.equal(mapFixtureStatus('AET'), 'finished');
    assert.equal(mapFixtureStatus('PST'), 'postponed');
    assert.equal(mapFixtureStatus('CANC'), 'canceled');
  });

  it('reports an unrecognised code as unknown rather than guessing', () => {
    assert.equal(mapFixtureStatus('ZZZ'), 'unknown');
    assert.equal(mapFixtureStatus(null), 'unknown');
    assert.equal(mapFixtureStatus(undefined), 'unknown');
  });
});

describe('fixture normalisation', () => {
  it('produces a fixture with its league and both teams', () => {
    const bundle = mapFixtureBundle(fixtureEntry(), OBSERVED_AT);
    assert.ok(bundle);

    assert.equal(bundle.fixture.id, 'af-1035037');
    assert.equal(bundle.fixture.provider, 'api-football');
    assert.equal(bundle.fixture.providerId, '1035037');
    assert.equal(bundle.fixture.kickoff, '2026-08-22T18:45:00.000Z');
    assert.equal(bundle.fixture.status, 'finished');
    assert.equal(bundle.fixture.homeScore, 2);
    assert.equal(bundle.fixture.awayScore, 1);
    assert.equal(bundle.fixture.season, 2026);
    assert.equal(bundle.fixture.venue, 'Stadio Olimpico');
    assert.equal(bundle.fixture.referee, 'Daniele Orsato');

    assert.equal(bundle.league.id, 'af-135');
    assert.equal(bundle.league.slug, 'serie_a', 'a covered competition resolves to its key');
    assert.equal(bundle.homeTeam.id, 'af-497');
    assert.equal(bundle.awayTeam.id, 'af-505');
    assert.equal(bundle.season?.year, 2026);
  });

  it('records elapsed time only while a match is live', () => {
    const finished = mapFixtureBundle(fixtureEntry(), OBSERVED_AT);
    assert.equal(finished?.fixture.elapsed, null);

    const live = mapFixtureBundle(
      fixtureEntry({
        fixture: {
          id: 1035038,
          date: '2026-08-22T18:45:00+00:00',
          status: { long: 'First Half', short: '1H', elapsed: 23 },
        },
      }),
      OBSERVED_AT,
    );
    assert.equal(live?.fixture.status, 'live');
    assert.equal(live?.fixture.elapsed, 23);
  });

  it('leaves an unplayed score null instead of writing zeros', () => {
    const bundle = mapFixtureBundle(
      fixtureEntry({
        fixture: {
          id: 1035039,
          date: '2026-08-22T18:45:00+00:00',
          status: { long: 'Not Started', short: 'NS', elapsed: null },
        },
        goals: { home: null, away: null },
      }),
      OBSERVED_AT,
    );
    assert.equal(bundle?.fixture.homeScore, null);
    assert.equal(bundle?.fixture.awayScore, null);
  });

  it('rejects a payload missing an identifier it cannot invent', () => {
    assert.equal(mapFixtureBundle(fixtureEntry({ fixture: { id: null, date: '2026-08-22T18:45:00+00:00' } })), null);
    assert.equal(mapFixtureBundle(fixtureEntry({ teams: { home: { id: 497 }, away: {} } })), null);
    assert.equal(mapFixtureBundle(fixtureEntry({ fixture: { id: 5, date: 'not-a-date' } })), null);
  });

  it('marks an uncovered competition with a null slug', () => {
    const bundle = mapFixtureBundle(
      fixtureEntry({ league: { id: 61, name: 'Ligue 1', country: 'France', season: 2026 } }),
      OBSERVED_AT,
    );
    assert.equal(bundle?.league.slug, null);
  });
});

describe('league and team mapping', () => {
  it('maps a league entry with its country', () => {
    const league = mapLeague({
      league: { id: 39, name: 'Premier League', type: 'League', logo: 'x.png' },
      country: { name: 'England', code: 'GB' },
    });
    assert.equal(league?.id, 'af-39');
    assert.equal(league?.name, 'Premier League');
    assert.equal(league?.countryCode, 'GB');
    assert.equal(league?.type, 'league');
    assert.equal(league?.slug, 'premier_league');
  });

  it('maps a team and keeps unreported fields null', () => {
    const team = mapTeam({
      team: { id: 505, name: 'Inter', code: 'INT', country: 'Italy', founded: 1908, logo: 'i.png' },
      venue: { name: 'Giuseppe Meazza' },
    });
    assert.equal(team?.id, 'af-505');
    assert.equal(team?.founded, 1908);
    assert.equal(team?.venueName, 'Giuseppe Meazza');

    const sparse = mapTeam({ team: { id: 506, name: 'Genoa' } });
    assert.equal(sparse?.code, null);
    assert.equal(sparse?.founded, null);
    assert.equal(sparse?.venueName, null);
  });

  it('drops an entry with no usable identity', () => {
    assert.equal(mapTeam({ team: { id: null, name: 'Nobody' } }), null);
    assert.equal(mapTeam({ team: { id: 1, name: '   ' } }), null);
    assert.equal(mapLeague({ league: { id: 1 } }), null);
  });
});

describe('fixture statistics', () => {
  const entries = [
    {
      team: { id: 497, name: 'AS Roma' },
      statistics: [
        { type: 'Shots on Goal', value: 6 },
        { type: 'Total Shots', value: 14 },
        { type: 'Ball Possession', value: '58%' },
        { type: 'Total passes', value: 512 },
        { type: 'Passes %', value: '87%' },
        { type: 'expected_goals', value: '1.84' },
        { type: 'Corner Kicks', value: null },
      ],
    },
    {
      team: { id: 505, name: 'Inter' },
      statistics: [
        { type: 'Shots on Goal', value: 3 },
        { type: 'Ball Possession', value: '42%' },
      ],
    },
  ];

  it('assigns each side by team id, not by array order', () => {
    const reversed = [entries[1]!, entries[0]!];
    const stats = mapFixtureStatistics('af-1035037', reversed, '497', '505', OBSERVED_AT);

    assert.equal(stats?.home.shotsOnGoal, 6, 'home is Roma regardless of position');
    assert.equal(stats?.away.shotsOnGoal, 3);
    assert.equal(stats?.home.possession, 58);
    assert.equal(stats?.away.possession, 42);
  });

  it('separates the pass count from the pass percentage', () => {
    const stats = mapFixtureStatistics('af-1035037', entries, '497', '505', OBSERVED_AT);
    assert.equal(stats?.home.passes, 512);
    assert.equal(stats?.home.passesPercentage, 87);
  });

  it('keeps a statistic the provider did not measure as null', () => {
    const stats = mapFixtureStatistics('af-1035037', entries, '497', '505', OBSERVED_AT);
    assert.equal(stats?.home.corners, null, 'a null in the feed must not become 0');
    assert.equal(stats?.away.totalShots, null);
    assert.equal(stats?.away.expectedGoals, null, 'xG is never invented');
  });

  it('reads a decimal expected-goals value without rounding it away', () => {
    const stats = mapFixtureStatistics('af-1035037', entries, '497', '505', OBSERVED_AT);
    assert.equal(stats?.home.expectedGoals, 1.84);
  });

  it('returns null when neither side is present', () => {
    assert.equal(mapFixtureStatistics('af-1', [], '497', '505', OBSERVED_AT), null);
    assert.equal(mapFixtureStatistics('af-1', entries, '900', '901', OBSERVED_AT), null);
  });

  it('starts from an all-null record', () => {
    const empty = emptyTeamStatistics();
    assert.ok(Object.values(empty).every((value) => value === null));
  });
});

describe('standings', () => {
  it('flattens groups into one row per team', () => {
    const rows = mapStandings(
      {
        league: {
          id: 135,
          season: 2026,
          standings: [
            [
              {
                rank: 1,
                team: { id: 505, name: 'Inter' },
                points: 78,
                goalsDiff: 42,
                form: 'WWDWW',
                all: { played: 32, win: 24, draw: 6, lose: 2, goals: { for: 70, against: 28 } },
                home: { played: 16, win: 14, draw: 1, lose: 1, goals: { for: 40, against: 12 } },
              },
              { rank: 2, team: { id: 497, name: 'AS Roma' }, points: 70 },
            ],
          ],
        },
      },
      OBSERVED_AT,
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.teamId, 'af-505');
    assert.equal(rows[0]?.points, 78);
    assert.equal(rows[0]?.goalDifference, 42);
    assert.equal(rows[0]?.homeRecord?.wins, 14);
    assert.equal(rows[1]?.awayRecord, null, 'a split the feed omitted stays null');
  });
});

describe('lineups and injuries', () => {
  it('treats eleven named starters as a confirmed lineup', () => {
    const startXI = Array.from({ length: 11 }, (_, index) => ({
      player: { id: index + 1, name: `Player ${index + 1}`, number: index + 1, pos: 'M', grid: '2:1' },
    }));

    const lineup = mapLineup('af-1035037', {
      team: { id: 497 },
      formation: '4-3-3',
      coach: { name: 'A Coach' },
      startXI,
      substitutes: [{ player: { id: 90, name: 'Sub One' } }],
    }, OBSERVED_AT);

    assert.equal(lineup?.teamId, 'af-497');
    assert.equal(lineup?.formation, '4-3-3');
    assert.equal(lineup?.startingXI.length, 11);
    assert.equal(lineup?.substitutes.length, 1);
    assert.equal(lineup?.confirmed, true);
  });

  it('treats a partial sheet as unconfirmed', () => {
    const lineup = mapLineup('af-1035037', {
      team: { id: 497 },
      startXI: [{ player: { id: 1, name: 'Only One' } }],
    }, OBSERVED_AT);
    assert.equal(lineup?.confirmed, false);
  });

  it('gives an injury a deterministic id so a re-sync updates it', () => {
    const entry = {
      player: { id: 276, name: 'A Player', type: 'Missing Fixture', reason: 'Knee Injury' },
      team: { id: 497 },
      fixture: { id: 1035037 },
    };
    const first = mapInjury(entry, OBSERVED_AT);
    const second = mapInjury(entry, new Date('2026-08-16T09:00:00.000Z'));

    assert.equal(first?.id, second?.id);
    assert.equal(first?.teamId, 'af-497');
    assert.equal(first?.fixtureId, 'af-1035037');
    assert.equal(first?.reason, 'Knee Injury');
  });
});

describe('odds mapping', () => {
  it('flattens bookmaker, market and selection into one snapshot per price', () => {
    const snapshots = mapOdds(
      'af-1035037',
      {
        bookmakers: [
          {
            id: 8,
            name: 'Bet365',
            bets: [
              {
                id: 1,
                name: 'Match Winner',
                values: [
                  { value: 'Home', odd: '2.10' },
                  { value: 'Draw', odd: '3.40' },
                  { value: 'Away', odd: '3.60' },
                ],
              },
            ],
          },
        ],
      },
      OBSERVED_AT,
    );

    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[0]?.bookmaker, 'Bet365');
    assert.equal(snapshots[0]?.market, 'Match Winner');
    assert.equal(snapshots[0]?.selection, 'Home');
    assert.equal(snapshots[0]?.decimalOdds, 2.1);
    assert.equal(snapshots[0]?.capturedAt, OBSERVED_AT.toISOString());
  });

  it('skips a price it cannot read', () => {
    const snapshots = mapOdds('af-1', {
      bookmakers: [
        { id: 8, name: 'Bet365', bets: [{ id: 1, name: 'Match Winner', values: [{ value: 'Home', odd: 'n/a' }] }] },
      ],
    }, OBSERVED_AT);
    assert.equal(snapshots.length, 0);
  });
});
