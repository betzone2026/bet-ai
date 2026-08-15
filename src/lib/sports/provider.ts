/**
 * The contract every sports feed must satisfy.
 *
 * Deliberately written in SportAlpha's vocabulary, not any vendor's: queries
 * take our own league keys and ISO dates, and results come back as normalised
 * models. Swapping API-Football for Sportmonks, or running both, is an adapter
 * change and nothing else.
 */

import type { LeagueKey } from './config.ts';
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
} from './types.ts';

export interface FixtureQuery {
  /** ISO date (`YYYY-MM-DD`) in UTC. */
  date?: string;
  /** Competitions to fetch. Defaults to the whole supported slate. */
  leagues?: LeagueKey[];
  /** Season label; defaults to the season containing `date`. */
  season?: number;
  /** Inclusive date range, used instead of `date`. */
  from?: string;
  to?: string;
}

export interface StandingsQuery {
  league: LeagueKey;
  season?: number;
}

export interface TeamQuery {
  league: LeagueKey;
  season?: number;
}

export interface InjuryQuery {
  /** Internal fixture id. */
  fixtureId?: string;
  league?: LeagueKey;
  date?: string;
  season?: number;
}

export interface HeadToHeadQuery {
  /** Internal team ids. */
  homeTeamId: string;
  awayTeamId: string;
  limit?: number;
}

/**
 * What one provider call cost, reported back so the quota tracker can record it
 * without the caller having to know how many HTTP requests an operation took.
 */
export interface ProviderUsage {
  endpoint: string;
  requests: number;
}

export interface SportsDataProvider {
  /** Stable identifier written onto every row this provider produces. */
  readonly name: string;

  /**
   * Whether credentials are present. Never throws: a missing key is a
   * configuration state the app has to render, not an error that breaks it.
   */
  isConfigured(): boolean;

  getLeagues(): Promise<League[]>;
  getFixtures(query: FixtureQuery): Promise<FixtureBundle[]>;
  getFixture(id: string): Promise<FixtureBundle | null>;
  getTeams(query: TeamQuery): Promise<Team[]>;
  getTeam(id: string): Promise<Team | null>;
  getStandings(query: StandingsQuery): Promise<Standing[]>;
  /**
   * Statistics are reported per team, so the caller may pass the fixture's team
   * ids to spare the adapter a lookup it would otherwise have to make.
   */
  getFixtureStatistics(
    fixtureId: string,
    teams?: { homeTeamId: string; awayTeamId: string },
  ): Promise<FixtureStatistics | null>;
  getLineups(fixtureId: string): Promise<Lineup[]>;
  getInjuries(query: InjuryQuery): Promise<Injury[]>;
  getOdds(fixtureId: string): Promise<OddsSnapshot[]>;
  getHeadToHead(query: HeadToHeadQuery): Promise<HeadToHead>;

  /** Requests consumed since this instance was created. */
  usage(): ProviderUsage[];
}
