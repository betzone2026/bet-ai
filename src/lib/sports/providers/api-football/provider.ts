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
  leagueKeyForProviderId,
  providerIdFrom,
  providerLeagueId,
  seasonForDate,
  type LeagueKey,
} from '../../config.ts';
import { SportsProviderError, describeError } from '../../errors.ts';
import type {
  CompetitionSighting,
  FixtureInspection,
  FixtureQuery,
  HeadToHeadQuery,
  InjuryQuery,
  LeagueCoverageReport,
  ProviderUsage,
  SeasonCoverage,
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

/**
 * Running totals for one fixtures fetch.
 *
 * Kept separate from the mapping so a range query, which spans several
 * requests, produces one set of numbers rather than one per request.
 */
interface Accumulator {
  providerReturned: number;
  matched: number;
  unmappable: number;
  truncated: boolean;
  competitions: Map<string, CompetitionSighting>;
  bundles: FixtureBundle[];
  observedAt: Date;
}

function newAccumulator(): Accumulator {
  return {
    providerReturned: 0,
    matched: 0,
    unmappable: 0,
    truncated: false,
    competitions: new Map(),
    bundles: [],
    observedAt: new Date(),
  };
}

/**
 * Folds one page of provider entries into the totals.
 *
 * Every entry is counted and its competition recorded *before* the supported
 * filter runs — that ordering is the entire feature. Counting only what
 * survives the filter is what made a wrong league id indistinguishable from an
 * empty day in the first place.
 */
function absorb(
  accumulator: Accumulator,
  entries: ApiFootballFixtureEntry[],
  wanted: Map<string, LeagueKey>,
): void {
  for (const entry of entries) {
    accumulator.providerReturned += 1;

    const rawLeagueId = entry.league?.id;
    if (rawLeagueId === null || rawLeagueId === undefined) continue;
    const leagueId = String(rawLeagueId);

    const sighting = accumulator.competitions.get(leagueId);
    if (sighting) {
      sighting.fixtures += 1;
    } else {
      accumulator.competitions.set(leagueId, {
        providerLeagueId: leagueId,
        name: entry.league?.name?.trim() || `League ${leagueId}`,
        country: entry.league?.country?.trim() || null,
        fixtures: 1,
        leagueKey: leagueKeyForProviderId(API_FOOTBALL_PROVIDER, leagueId),
        supported: wanted.has(leagueId),
      });
    }

    if (!wanted.has(leagueId)) continue;
    accumulator.matched += 1;

    if (accumulator.truncated) continue;

    const bundle = mapFixtureBundle(entry, accumulator.observedAt);
    if (!bundle) {
      accumulator.unmappable += 1;
      continue;
    }

    accumulator.bundles.push(bundle);
    if (accumulator.bundles.length >= MAX_FIXTURES_PER_SYNC) accumulator.truncated = true;
  }
}

/** Freezes the totals into the shape callers consume, most fixtures first. */
function summarise(date: string, accumulator: Accumulator): FixtureInspection {
  return {
    date,
    providerReturned: accumulator.providerReturned,
    matched: accumulator.matched,
    unmappable: accumulator.unmappable,
    truncated: accumulator.truncated,
    competitions: [...accumulator.competitions.values()].sort(
      (a, b) =>
        Number(b.supported) - Number(a.supported) ||
        b.fixtures - a.fixtures ||
        a.name.localeCompare(b.name),
    ),
    bundles: accumulator.bundles,
  };
}

/** Reads one `leagues?id=` entry into the season/coverage diagnostic. */
function mapLeagueCoverage(
  leagueKey: LeagueKey,
  providerId: string,
  entry: ApiFootballLeagueEntry | null,
): LeagueCoverageReport {
  const configured = SUPPORTED_LEAGUES[leagueKey];

  if (!entry) {
    return {
      leagueKey,
      providerLeagueId: providerId,
      name: configured?.name ?? leagueKey,
      country: configured?.country ?? null,
      currentSeason: null,
      latestSeason: null,
      seasons: [],
      fixturesAvailable: false,
      error: `${API_FOOTBALL_PROVIDER} returned no league for id ${providerId}.`,
    };
  }

  const seasons: SeasonCoverage[] = (entry.seasons ?? []).flatMap((season) => {
    if (typeof season.year !== 'number' || !Number.isFinite(season.year)) return [];
    const coverage = season.coverage;
    return [
      {
        year: season.year,
        current: season.current === true,
        start: season.start ?? null,
        end: season.end ?? null,
        // The plan exposes fixtures for a season whenever it exposes any
        // fixture sub-feature; an all-false block means the season is listed
        // but not served.
        fixtures: Boolean(
          coverage?.fixtures?.events ||
            coverage?.fixtures?.lineups ||
            coverage?.fixtures?.statistics_fixtures ||
            coverage?.fixtures?.statistics_players ||
            coverage?.standings,
        ),
        standings: coverage?.standings === true,
        players: coverage?.players === true,
        odds: coverage?.odds === true,
        injuries: coverage?.injuries === true,
      } satisfies SeasonCoverage,
    ];
  });

  seasons.sort((a, b) => b.year - a.year);

  return {
    leagueKey,
    providerLeagueId: entry.league?.id === undefined || entry.league?.id === null
      ? providerId
      : String(entry.league.id),
    name: entry.league?.name?.trim() || configured?.name || leagueKey,
    country: entry.country?.name?.trim() || configured?.country || null,
    currentSeason: seasons.find((season) => season.current)?.year ?? null,
    latestSeason: seasons[0]?.year ?? null,
    seasons,
    fixturesAvailable: seasons.some((season) => season.fixtures),
    error: null,
  };
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
    const inspection = await this.inspectFixtures(query);
    return inspection.bundles;
  }

  /**
   * The same fetch, with the discarded half of it reported.
   *
   * Filtering locally is cheap but blind: once the unsupported competitions are
   * dropped there is no way to tell a quiet Tuesday from a wrong league id. This
   * keeps both counts and every competition it saw, which is what the admin
   * preview shows and what the sync records on its run.
   */
  async inspectFixtures(query: FixtureQuery): Promise<FixtureInspection> {
    const leagues = query.leagues?.length ? query.leagues : SUPPORTED_LEAGUE_KEYS;

    const wanted = new Map<string, LeagueKey>();
    for (const key of leagues) {
      const id = providerLeagueId(key, this.name);
      if (id) wanted.set(id, key);
    }

    const date = query.date ?? isoDate(new Date());
    const accumulator = newAccumulator();
    if (wanted.size === 0) return summarise(date, accumulator);

    if (query.from || query.to) {
      await this.collectByLeague(query, wanted, accumulator);
      return summarise(query.from ?? date, accumulator);
    }

    const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', { date });
    absorb(accumulator, envelope.response ?? [], wanted);
    return summarise(date, accumulator);
  }

  /** Range queries: one request per competition, as the endpoint demands. */
  private async collectByLeague(
    query: FixtureQuery,
    wanted: Map<string, LeagueKey>,
    accumulator: Accumulator,
  ): Promise<void> {
    const referenceDate = query.from
      ? new Date(`${query.from}T12:00:00Z`)
      : query.date
        ? new Date(`${query.date}T12:00:00Z`)
        : new Date();
    const season = query.season ?? seasonForDate(referenceDate);

    for (const leagueId of wanted.keys()) {
      const envelope = await this.client.get<ApiFootballFixtureEntry>('fixtures', {
        league: leagueId,
        season,
        from: query.from,
        to: query.to ?? query.from,
      });
      absorb(accumulator, envelope.response ?? [], wanted);
      if (accumulator.truncated) return;
    }
  }

  /**
   * Season and coverage diagnostic, one request per configured competition.
   *
   * `leagues?id=` carries every season the caller's plan exposes together with
   * what each one covers, which is the authoritative answer to "does this key
   * see the 2026 season?". Asking it costs one request per league — three on the
   * current slate — and the result is cached in the database, so the question is
   * asked when an operator wants it answered and not on every page load.
   *
   * A competition that fails is reported as a failed competition rather than
   * failing the whole diagnostic: knowing that two of three are healthy is more
   * useful than knowing the run threw.
   */
  async getLeagueCoverage(leagues?: LeagueKey[]): Promise<LeagueCoverageReport[]> {
    const keys = leagues?.length ? leagues : SUPPORTED_LEAGUE_KEYS;
    const reports: LeagueCoverageReport[] = [];

    for (const key of keys) {
      const id = providerLeagueId(key, this.name);
      if (!id) {
        reports.push({
          leagueKey: key,
          providerLeagueId: null,
          name: SUPPORTED_LEAGUES[key]?.name ?? key,
          country: SUPPORTED_LEAGUES[key]?.country ?? null,
          currentSeason: null,
          latestSeason: null,
          seasons: [],
          fixturesAvailable: false,
          error: `No ${this.name} league id is configured for ${key}.`,
        });
        continue;
      }

      try {
        const envelope = await this.client.get<ApiFootballLeagueEntry>('leagues', { id });
        reports.push(mapLeagueCoverage(key, id, envelope.response?.[0] ?? null));
      } catch (error) {
        reports.push({
          leagueKey: key,
          providerLeagueId: id,
          name: SUPPORTED_LEAGUES[key]?.name ?? key,
          country: SUPPORTED_LEAGUES[key]?.country ?? null,
          currentSeason: null,
          latestSeason: null,
          seasons: [],
          fixturesAvailable: false,
          error: describeError(error),
        });
      }
    }

    return reports;
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
