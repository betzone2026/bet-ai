/**
 * API-Football implementation of `SportsDataProvider`.
 *
 * This is the only file in the codebase that knows what an API-Football
 * endpoint is called or which query parameters it takes. Everything above it
 * speaks SportAlpha league keys, internal ids and normalised models.
 */

import {
  MAX_FIXTURES_PER_SYNC,
  SUPPORTED_LEAGUES,
  SUPPORTED_LEAGUE_KEYS,
  providerIdFrom,
  providerLeagueId,
  seasonForDate,
  type LeagueKey,
} from '../../config.ts';
import { SportsProviderError } from '../../errors.ts';
import type {
  FixtureQuery,
  HeadToHeadQuery,
  InjuryQuery,
  ProviderUsage,
  SportsDataProvider,
  StandingsQuery,
  TeamQuery,
} from '../../provider.ts';
import type {
  FixtureBundle,
  FixtureStatistics,
  HeadToHead,
  Injury,
  League,
  Lineup,
  OddsSnapshot,
  Standing,
  Team,
} from '../../types.ts';
import { API_FOOTBALL_PROVIDER, ApiFootballClient, type ApiFootballClientOptions } from './client.ts';
import {
  mapFixtureBundle,
  mapFixtureStatistics,
  mapInjury,
  mapLeague,
  mapLineup,
  mapOdds,
  mapStandings,
  mapTeam,
} from './mapper.ts';
import type {
  ApiFootballFixtureEntry,
  ApiFootballInjuryEntry,
  ApiFootballLeagueEntry,
  ApiFootballLineupEntry,
  ApiFootballOddsEntry,
  ApiFootballStandingsEntry,
  ApiFootballStatisticsEntry,
  ApiFootballTeamEntry,
} from './types.ts';

/** Turns an internal id back into the provider's own, refusing foreign ids. */
function requireProviderId(id: string, what: string): string {
  const providerId = providerIdFrom(id, API_FOOTBALL_PROVIDER);
  if (!providerId) {
    throw new SportsProviderError(
      'INVALID_RESPONSE',
      `${what} "${id}" does not belong to ${API_FOOTBALL_PROVIDER}.`,
      { provider: API_FOOTBALL_PROVIDER },
    );
  }
  return providerId;
}

/** `YYYY-MM-DD` in UTC, the only date format the endpoint accepts. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class ApiFootballProvider implements SportsDataProvider {
  readonly name = API_FOOTBALL_PROVIDER;
  private readonly client: ApiFootballClient;

  constructor(options: ApiFootballClientOptions | ApiFootballClient = {}) {
    this.client = options instanceof ApiFootballClient ? options : new ApiFootballClient(options);
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  usage(): ProviderUsage[] {
    return this.client.usage();
  }

  /** Quota headers from the most recent response, for the admin screen. */
  rateLimit() {
    return this.client.rateLimit();
  }

  /** Everything the last response revealed, for the quota tracker. */
  lastResponse() {
    return this.client.lastResponse();
  }

  async getLeagues(): Promise<League[]> {
    const leagues: League[] = [];
    for (const key of SUPPORTED_LEAGUE_KEYS) {
      const id = providerLeagueId(key, this.name);
      if (!id) continue;
      const envelope = await this.client.get<ApiFootballLeagueEntry>('leagues', { id });
      for (const entry of envelope.response ?? []) {
        const league = mapLeague(entry);
        if (league) leagues.push(league);
      }
    }
    return leagues;
  }

  /**
   * One request for the whole day, filtered locally.
   *
   * `fixtures?date=` returns every competition playing on that date, so asking
   * for it once and discarding the competitions we do not follow costs a single
   * request instead of one per league. On a 100-request Free plan that is the
   * difference between a sync costing 3% of the day's allowance and 1%.
   *
   * It is also the only shape that works: `season` and `date` together are
   * rejected on the Free plan, because the plan's seasons and the plan's date
   * window do not overlap. The date-only form has neither problem.
   *
   * A date range is the exception — that form of the endpoint requires `league`
   * and `season`, so it falls back to one request per competition.
   */
  async getFixtures(query: FixtureQuery): Promise<FixtureBundle[]> {
    const leagues = query.leagues?.length ? query.leagues : SUPPORTED_LEAGUE_KEYS;

    const wanted = new Map<string, LeagueKey>();
    for (const key of leagues) {
      const id = providerLeagueId(key, this.name);
      if (id) wanted.set(id, key);
    }
    if (wanted.size === 0) return [];

    if (query.from || query.to) {
      return this.getFixturesByLeague(query, [...wanted.keys()]);
    }

    return this.getFixturesByDate(query.date ?? isoDate(new Date()), wanted);
  }

  /** The low-cost path: one call, local filtering. */
  private async getFixturesByDate(
    date: string,
    wanted: Map<string, LeagueKey>,
  ): Promise<FixtureBundle[]> {
    const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', { date });
    const observedAt = new Date();
    const bundles: FixtureBundle[] = [];

    for (const entry of envelope.response ?? []) {
      const leagueId = entry.league?.id;
      if (leagueId === null || leagueId === undefined) continue;
      if (!wanted.has(String(leagueId))) continue;

      const bundle = mapFixtureBundle(entry, observedAt);
      if (bundle) bundles.push(bundle);
      if (bundles.length >= MAX_FIXTURES_PER_SYNC) return bundles;
    }

    return bundles;
  }

  /** Range queries: one request per competition, as the endpoint demands. */
  private async getFixturesByLeague(
    query: FixtureQuery,
    leagueIds: string[],
  ): Promise<FixtureBundle[]> {
    const referenceDate = query.from
      ? new Date(`${query.from}T12:00:00Z`)
      : query.date
        ? new Date(`${query.date}T12:00:00Z`)
        : new Date();
    const season = query.season ?? seasonForDate(referenceDate);
    const observedAt = new Date();
    const bundles: FixtureBundle[] = [];

    for (const leagueId of leagueIds) {
      const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', {
        league: leagueId,
        season,
        from: query.from,
        to: query.to ?? query.from,
      });

      for (const entry of envelope.response ?? []) {
        const bundle = mapFixtureBundle(entry, observedAt);
        if (bundle) bundles.push(bundle);
        if (bundles.length >= MAX_FIXTURES_PER_SYNC) return bundles;
      }
    }

    return bundles;
  }

  async getFixture(id: string): Promise<FixtureBundle | null> {
    const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', {
      id: requireProviderId(id, 'Fixture'),
    });
    const entry = envelope.response?.[0];
    return entry ? mapFixtureBundle(entry) : null;
  }

  async getTeams(query: TeamQuery): Promise<Team[]> {
    const leagueId = providerLeagueId(query.league, this.name);
    if (!leagueId) return [];

    const envelope = await this.client.get<ApiFootballTeamEntry>('teams', {
      league: leagueId,
      season: query.season ?? seasonForDate(new Date()),
    });
    return (envelope.response ?? []).flatMap((entry) => {
      const team = mapTeam(entry);
      return team ? [team] : [];
    });
  }

  async getTeam(id: string): Promise<Team | null> {
    const envelope = await this.client.get<ApiFootballTeamEntry>('teams', {
      id: requireProviderId(id, 'Team'),
    });
    const entry = envelope.response?.[0];
    return entry ? mapTeam(entry) : null;
  }

  async getStandings(query: StandingsQuery): Promise<Standing[]> {
    const leagueId = providerLeagueId(query.league, this.name);
    if (!leagueId) return [];

    const envelope = await this.client.get<ApiFootballStandingsEntry>('standings', {
      league: leagueId,
      season: query.season ?? seasonForDate(new Date()),
    });
    const observedAt = new Date();
    return (envelope.response ?? []).flatMap((entry) => mapStandings(entry, observedAt));
  }

  /**
   * Statistics are keyed by team, so home and away must be known before the
   * payload can be read. When the caller does not supply them the fixture is
   * fetched first — correctness is worth the extra request, since mixing the
   * two sides up would corrupt every downstream model silently.
   */
  async getFixtureStatistics(
    fixtureId: string,
    teams?: { homeTeamId: string; awayTeamId: string },
  ): Promise<FixtureStatistics | null> {
    const providerFixtureId = requireProviderId(fixtureId, 'Fixture');

    let homeTeamId = teams?.homeTeamId;
    let awayTeamId = teams?.awayTeamId;
    if (!homeTeamId || !awayTeamId) {
      const bundle = await this.getFixture(fixtureId);
      if (!bundle) return null;
      homeTeamId = bundle.fixture.homeTeamId;
      awayTeamId = bundle.fixture.awayTeamId;
    }

    const envelope = await this.client.get<ApiFootballStatisticsEntry>('fixtures/statistics', {
      fixture: providerFixtureId,
    });

    return mapFixtureStatistics(
      fixtureId,
      envelope.response ?? [],
      requireProviderId(homeTeamId, 'Team'),
      requireProviderId(awayTeamId, 'Team'),
    );
  }

  async getLineups(fixtureId: string): Promise<Lineup[]> {
    const envelope = await this.client.get<ApiFootballLineupEntry>('fixtures/lineups', {
      fixture: requireProviderId(fixtureId, 'Fixture'),
    });
    const observedAt = new Date();
    return (envelope.response ?? []).flatMap((entry) => {
      const lineup = mapLineup(fixtureId, entry, observedAt);
      return lineup ? [lineup] : [];
    });
  }

  async getInjuries(query: InjuryQuery): Promise<Injury[]> {
    const params: Record<string, string | number | undefined> = {};
    if (query.fixtureId) params.fixture = requireProviderId(query.fixtureId, 'Fixture');
    if (query.league) {
      const leagueId = providerLeagueId(query.league, this.name);
      if (!leagueId) return [];
      params.league = leagueId;
      params.season = query.season ?? seasonForDate(new Date());
    }
    if (query.date) params.date = query.date;
    if (Object.keys(params).length === 0) return [];

    const envelope = await this.client.get<ApiFootballInjuryEntry>('injuries', params);
    const observedAt = new Date();
    return (envelope.response ?? []).flatMap((entry) => {
      const injury = mapInjury(entry, observedAt);
      return injury ? [injury] : [];
    });
  }

  async getOdds(fixtureId: string): Promise<OddsSnapshot[]> {
    const envelope = await this.client.get<ApiFootballOddsEntry>('odds', {
      fixture: requireProviderId(fixtureId, 'Fixture'),
    });
    const capturedAt = new Date();
    return (envelope.response ?? []).flatMap((entry) => mapOdds(fixtureId, entry, capturedAt));
  }

  async getHeadToHead(query: HeadToHeadQuery): Promise<HeadToHead> {
    const home = requireProviderId(query.homeTeamId, 'Team');
    const away = requireProviderId(query.awayTeamId, 'Team');

    const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures/headtohead', {
      h2h: `${home}-${away}`,
      last: query.limit ?? 10,
    });

    const observedAt = new Date();
    return {
      homeTeamId: query.homeTeamId,
      awayTeamId: query.awayTeamId,
      fixtures: (envelope.response ?? []).flatMap((entry) => {
        const bundle = mapFixtureBundle(entry, observedAt);
        return bundle ? [bundle] : [];
      }),
    };
  }
}

/** Competitions this adapter can actually serve, for the admin screen. */
export function configuredLeagueKeys(): LeagueKey[] {
  return SUPPORTED_LEAGUE_KEYS.filter(
    (key) => SUPPORTED_LEAGUES[key].providerIds[API_FOOTBALL_PROVIDER] !== undefined,
  );
}
