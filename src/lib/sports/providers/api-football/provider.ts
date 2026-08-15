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
   * One request per competition.
   *
   * The endpoint accepts a single `league`, so the supported slate costs three
   * requests per day rather than one. That is the price of not importing the
   * whole world, and it is the cheaper side of the trade.
   */
  async getFixtures(query: FixtureQuery): Promise<FixtureBundle[]> {
    const leagues = query.leagues?.length ? query.leagues : SUPPORTED_LEAGUE_KEYS;
    const referenceDate = query.date ? new Date(`${query.date}T12:00:00Z`) : new Date();
    const season = query.season ?? seasonForDate(referenceDate);
    const observedAt = new Date();
    const bundles: FixtureBundle[] = [];

    for (const key of leagues) {
      const leagueId = providerLeagueId(key, this.name);
      if (!leagueId) continue;

      const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', {
        league: leagueId,
        season,
        date: query.from ? undefined : query.date,
        from: query.from,
        to: query.to,
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
