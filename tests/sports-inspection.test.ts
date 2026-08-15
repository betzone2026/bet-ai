/**
 * What a fixtures fetch reports back, and what it costs.
 *
 * The provider is driven by an injected `fetch` throughout, so the suite never
 * reaches API-Football and never spends a request against the real allowance.
 * Every payload here is fabricated, and so is the key.
 *
 * The property under test is the one the admin screen depends on: the count of
 * what the provider sent survives alongside the count of what SportAlpha
 * matched. Collapsing them is what made a wrong league id look exactly like a
 * day with no football on it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPPORTED_LEAGUES, providerLeagueId } from '../src/lib/sports/config.ts';
import {
  debugCountsLine,
  describeFixtureOutcome,
  describeRequestCost,
  fixtureOutcome,
} from '../src/lib/sports/messages.ts';
import { ApiFootballProvider } from '../src/lib/sports/providers/api-football/provider.ts';

const TEST_KEY = 'test-key-not-a-real-credential';
const SERIE_A = providerLeagueId('serie_a', 'api-football');
const PREMIER_LEAGUE = providerLeagueId('premier_league', 'api-football');
const CHAMPIONS_LEAGUE = providerLeagueId('champions_league', 'api-football');

/** Records every call so request cost can be asserted, not assumed. */
function stubFetch(responder: (url: string) => unknown) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    return new Response(JSON.stringify(responder(url)), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-requests-limit': '100',
        'x-ratelimit-requests-remaining': '97',
        'x-ratelimit-limit': '10',
        'x-ratelimit-remaining': '9',
      },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function fixturesEnvelope(response: unknown[]) {
  return {
    get: 'fixtures',
    parameters: {},
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  };
}

let nextFixtureId = 900_000;

/** A minimally complete entry — enough for the mapper to produce a bundle. */
function entry(leagueId: string, leagueName: string, country: string) {
  nextFixtureId += 1;
  const homeId = nextFixtureId * 2;
  const awayId = homeId + 1;
  return {
    fixture: {
      id: nextFixtureId,
      referee: null,
      timezone: 'UTC',
      date: '2026-08-22T18:45:00+00:00',
      status: { long: 'Not Started', short: 'NS', elapsed: null },
      venue: { id: 1, name: 'Ground', city: 'Town' },
    },
    league: {
      id: Number(leagueId),
      name: leagueName,
      country,
      season: 2026,
      round: 'Regular Season - 1',
    },
    teams: {
      home: { id: homeId, name: `Home ${homeId}` },
      away: { id: awayId, name: `Away ${awayId}` },
    },
    goals: { home: null, away: null },
  };
}

function provider(responder: (url: string) => unknown) {
  const { impl, calls } = stubFetch(responder);
  return { provider: new ApiFootballProvider({ apiKey: TEST_KEY, fetchImpl: impl }), calls };
}

describe('provider returns no fixtures', () => {
  it('reports an empty day as empty, not as a filter miss', async () => {
    const { provider: sut, calls } = provider(() => fixturesEnvelope([]));

    const inspection = await sut.inspectFixtures({ date: '2026-06-24' });

    assert.equal(inspection.providerReturned, 0);
    assert.equal(inspection.matched, 0);
    assert.deepEqual(inspection.competitions, []);
    assert.deepEqual(inspection.bundles, []);
    assert.equal(calls.length, 1, 'a day costs exactly one request');
  });

  it('words it as the provider having sent nothing', () => {
    const message = describeFixtureOutcome({
      providerReturned: 0,
      matched: 0,
      date: '2026-06-24',
    });
    assert.equal(message, 'No fixtures were returned by API-Football for 2026-06-24.');
    assert.equal(fixtureOutcome(0, 0), 'EMPTY_PROVIDER');
  });
});

describe('provider returns fixtures but none are supported', () => {
  it('keeps the provider total even though nothing was matched', async () => {
    const unsupported = [
      entry('61', 'Ligue 1', 'France'),
      entry('61', 'Ligue 1', 'France'),
      entry('88', 'Eredivisie', 'Netherlands'),
    ];
    const { provider: sut } = provider(() => fixturesEnvelope(unsupported));

    const inspection = await sut.inspectFixtures({ date: '2026-08-22' });

    assert.equal(inspection.providerReturned, 3);
    assert.equal(inspection.matched, 0);
    assert.equal(inspection.bundles.length, 0, 'nothing unsupported may be imported');
    assert.equal(inspection.competitions.length, 2);
    assert.equal(
      inspection.competitions.every((competition) => !competition.supported),
      true,
    );
  });

  it('says the filter matched nothing rather than printing a bare zero', () => {
    const message = describeFixtureOutcome({
      providerReturned: 47,
      matched: 0,
      date: '2026-08-22',
    });
    assert.equal(
      message,
      'Provider returned fixtures, but none matched the configured competitions. API-Football returned 47 fixtures across other competitions.',
    );
    assert.equal(fixtureOutcome(47, 0), 'NO_MATCH');

    // The two zero cases must never produce the same sentence — telling them
    // apart is the reason both counts are carried at all.
    assert.notEqual(
      describeFixtureOutcome({ providerReturned: 0, matched: 0, date: '2026-08-22' }),
      message,
    );
  });
});

describe('provider returns supported fixtures', () => {
  it('imports the supported ones and counts the rest', async () => {
    assert.ok(SERIE_A && PREMIER_LEAGUE);
    const slate = [
      entry(SERIE_A, 'Serie A', 'Italy'),
      entry(SERIE_A, 'Serie A', 'Italy'),
      entry(PREMIER_LEAGUE, 'Premier League', 'England'),
      entry('61', 'Ligue 1', 'France'),
      entry('88', 'Eredivisie', 'Netherlands'),
      entry('88', 'Eredivisie', 'Netherlands'),
    ];
    const { provider: sut, calls } = provider(() => fixturesEnvelope(slate));

    const inspection = await sut.inspectFixtures({ date: '2026-08-22' });

    assert.equal(inspection.providerReturned, 6);
    assert.equal(inspection.matched, 3);
    assert.equal(inspection.bundles.length, 3);
    assert.equal(inspection.unmappable, 0);
    assert.equal(inspection.truncated, false);
    assert.equal(calls.length, 1);
    assert.equal(
      describeFixtureOutcome({ providerReturned: 6, matched: 3 }),
      'Provider returned: 6 · SportAlpha matched: 3',
    );
    assert.equal(debugCountsLine(6, 3), 'Provider returned: 6 · SportAlpha matched: 3');
  });

  it('asks for the chosen date and adds no season to it', async () => {
    const { provider: sut, calls } = provider(() => fixturesEnvelope([]));

    await sut.inspectFixtures({ date: '2026-08-22' });

    const url = calls[0] ?? '';
    assert.match(url, /\/fixtures\?/);
    assert.match(url, /date=2026-08-22/);
    // `season` together with `date` is rejected on the Free plan, so the
    // date-only form is the only one that works — and the only one sent.
    assert.equal(/[?&]season=/.test(url), false);
    assert.equal(/[?&]league=/.test(url), false);
  });
});

describe('league filtering', () => {
  it('keeps only the competitions asked for', async () => {
    assert.ok(SERIE_A && PREMIER_LEAGUE && CHAMPIONS_LEAGUE);
    const slate = [
      entry(SERIE_A, 'Serie A', 'Italy'),
      entry(PREMIER_LEAGUE, 'Premier League', 'England'),
      entry(CHAMPIONS_LEAGUE, 'UEFA Champions League', 'World'),
    ];
    const { provider: sut } = provider(() => fixturesEnvelope(slate));

    const inspection = await sut.inspectFixtures({ date: '2026-08-22', leagues: ['serie_a'] });

    assert.equal(inspection.providerReturned, 3, 'the provider total ignores our filter');
    assert.equal(inspection.matched, 1);
    assert.equal(inspection.bundles[0]?.league.id, `af-${SERIE_A}`);

    const supported = inspection.competitions.filter((competition) => competition.supported);
    assert.deepEqual(
      supported.map((competition) => competition.providerLeagueId),
      [SERIE_A],
    );
  });

  it('matches on the configured provider ids, not on names', async () => {
    assert.ok(SERIE_A);
    // Same league id, a name the provider could rename at any time.
    const { provider: sut } = provider(() =>
      fixturesEnvelope([entry(SERIE_A, 'Italian Serie A (renamed)', 'Italy')]),
    );

    const inspection = await sut.inspectFixtures({ date: '2026-08-22' });

    assert.equal(inspection.matched, 1);
    assert.equal(inspection.competitions[0]?.leagueKey, 'serie_a');
  });

  it('spends nothing when no requested competition has a configured id', async () => {
    const { provider: sut, calls } = provider(() => fixturesEnvelope([]));

    const inspection = await sut.inspectFixtures({ date: '2026-08-22', leagues: [] as never[] });

    assert.equal(calls.length, 1, 'an empty list falls back to the configured slate');
    assert.equal(inspection.providerReturned, 0);
  });
});

describe('league id discovery', () => {
  it('lists every competition in the response with its id and country', async () => {
    assert.ok(SERIE_A);
    const slate = [
      entry('61', 'Ligue 1', 'France'),
      entry('61', 'Ligue 1', 'France'),
      entry('61', 'Ligue 1', 'France'),
      entry(SERIE_A, 'Serie A', 'Italy'),
      entry('88', 'Eredivisie', 'Netherlands'),
    ];
    const { provider: sut } = provider(() => fixturesEnvelope(slate));

    const inspection = await sut.inspectFixtures({ date: '2026-08-22' });

    // Supported first, so the configured ids can be checked at a glance
    // against what the provider actually calls them.
    const first = inspection.competitions[0];
    assert.equal(first?.providerLeagueId, SERIE_A);
    assert.equal(first?.supported, true);
    assert.equal(first?.country, 'Italy');
    assert.equal(first?.fixtures, 1);

    const ligue1 = inspection.competitions.find(
      (competition) => competition.providerLeagueId === '61',
    );
    assert.equal(ligue1?.fixtures, 3, 'sightings are counted, not just recorded');
    assert.equal(ligue1?.supported, false);
    assert.equal(ligue1?.leagueKey, null);
  });

  it('reads seasons and coverage from the provider rather than assuming them', async () => {
    const { provider: sut, calls } = provider(() => ({
      get: 'leagues',
      parameters: {},
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          league: { id: Number(SERIE_A), name: 'Serie A', type: 'League' },
          country: { name: 'Italy', code: 'IT' },
          seasons: [
            { year: 2024, current: false, start: '2024-08-17', end: '2025-05-25', coverage: { fixtures: { events: true }, standings: true } },
            { year: 2026, current: true, start: '2026-08-22', end: '2027-05-23', coverage: { fixtures: { events: true, lineups: true }, standings: true, odds: true } },
            { year: 2025, current: false, start: '2025-08-23', end: '2026-05-24', coverage: { fixtures: { events: false }, standings: false } },
          ],
        },
      ],
    }));

    const [report] = await sut.getLeagueCoverage(['serie_a']);

    assert.ok(report);
    assert.equal(report.leagueKey, 'serie_a');
    assert.equal(report.providerLeagueId, SERIE_A);
    assert.equal(report.country, 'Italy');
    // No 2022-2024 window is assumed anywhere: the current season is whatever
    // the provider flags, which here is 2026.
    assert.equal(report.currentSeason, 2026);
    assert.equal(report.latestSeason, 2026);
    assert.deepEqual(report.seasons.map((season) => season.year), [2026, 2025, 2024]);
    assert.equal(report.fixturesAvailable, true);
    assert.equal(report.seasons.find((season) => season.year === 2025)?.fixtures, false);
    assert.equal(report.error, null);
    assert.equal(calls.length, 1, 'one request per competition');
  });

  it('reports a competition the provider does not know instead of failing the run', async () => {
    const { provider: sut } = provider((url) =>
      url.includes(`id=${SERIE_A}`)
        ? { get: 'leagues', parameters: {}, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] }
        : {
            get: 'leagues',
            parameters: {},
            errors: [],
            results: 1,
            paging: { current: 1, total: 1 },
            response: [
              {
                league: { id: Number(PREMIER_LEAGUE), name: 'Premier League' },
                country: { name: 'England' },
                seasons: [{ year: 2026, current: true, coverage: { standings: true } }],
              },
            ],
          },
    );

    const reports = await sut.getLeagueCoverage(['serie_a', 'premier_league']);

    assert.equal(reports.length, 2);
    assert.match(reports[0]?.error ?? '', /no league for id/);
    // The healthy competition still produces its answer.
    assert.equal(reports[1]?.error, null);
    assert.equal(reports[1]?.currentSeason, 2026);
    // The configured name survives so the row is still identifiable.
    assert.equal(reports[0]?.name, SUPPORTED_LEAGUES.serie_a.name);
  });
});

describe('API quota tracking', () => {
  it('counts one request per fixtures check and reads the quota headers', async () => {
    const { provider: sut } = provider(() => fixturesEnvelope([]));

    await sut.inspectFixtures({ date: '2026-08-22' });

    const usage = sut.usage();
    assert.equal(
      usage.reduce((total, entry_) => total + entry_.requests, 0),
      1,
    );
    assert.equal(usage[0]?.endpoint, 'fixtures');

    const limits = sut.rateLimit();
    assert.equal(limits?.dailyLimit, 100);
    assert.equal(limits?.dailyRemaining, 97);
    assert.equal(limits?.burstLimit, 10);
    assert.equal(limits?.burstRemaining, 9);
  });

  it('accumulates the cost of a three-competition coverage check', async () => {
    const { provider: sut, calls } = provider(() => ({
      get: 'leagues',
      parameters: {},
      errors: [],
      results: 1,
      paging: { current: 1, total: 1 },
      response: [
        {
          league: { id: 135, name: 'Serie A' },
          country: { name: 'Italy' },
          seasons: [{ year: 2026, current: true, coverage: { standings: true } }],
        },
      ],
    }));

    await sut.getLeagueCoverage(['serie_a', 'premier_league', 'champions_league']);

    assert.equal(calls.length, 3);
    assert.equal(
      sut.usage().reduce((total, entry_) => total + entry_.requests, 0),
      3,
    );
  });

  it('states the cost in the singular and the plural', () => {
    assert.equal(describeRequestCost(1), '1 API request');
    assert.equal(describeRequestCost(3), '3 API requests');
    assert.equal(describeRequestCost(0), '0 API requests');
  });
});
