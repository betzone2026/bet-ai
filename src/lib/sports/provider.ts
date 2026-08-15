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

/**
 * One competition observed in a raw fixtures response.
 *
 * This is what makes a misconfigured league id visible. `fixtures?date=` answers
 * with every competition playing that day; recording what came back — including
 * the competitions we do not follow — is how an admin confirms that Serie A's
 * provider id really is 135 rather than discovering months later that every
 * sync has been importing nothing.
 */
export interface CompetitionSighting {
  /** The provider's own league id, exactly as it appeared in the payload. */
  providerLeagueId: string;
  name: string;
  country: string | null;
  fixtures: number;
  /** SportAlpha's key when this competition is configured, else `null`. */
  leagueKey: string | null;
  supported: boolean;
}

/**
 * A fixtures fetch described in full, before anything is written.
 *
 * `providerReturned` and `matched` are tracked separately on purpose: their
 * difference is the only evidence that distinguishes "no football today" from
 * "the league filter is wrong". See `../messages.ts`.
 */
export interface FixtureInspection {
  date: string;
  /** Entries the provider sent, counted before any local filtering. */
  providerReturned: number;
  /** Entries belonging to the requested competitions. */
  matched: number;
  /** Matched entries that could not be normalised into a bundle. */
  unmappable: number;
  /** Every competition present in the response, matched or not. */
  competitions: CompetitionSighting[];
  /** The normalised, supported fixtures — what a sync would write. */
  bundles: FixtureBundle[];
  /** True when the runaway guard stopped the mapper short of the full slate. */
  truncated: boolean;
}

/** One season of a competition, with what the plan actually covers in it. */
export interface SeasonCoverage {
  year: number;
  current: boolean;
  start: string | null;
  end: string | null;
  /** Whether the plan serves fixtures for this season at all. */
  fixtures: boolean;
  standings: boolean;
  players: boolean;
  odds: boolean;
  injuries: boolean;
}

/**
 * What the provider says it can serve for one configured competition.
 *
 * The point is to stop guessing. A plan's season window is a fact the provider
 * publishes, and hardcoding an assumed range into the codebase turns a fact into
 * a stale constant that silently breaks the pipeline the day the plan changes.
 */
export interface LeagueCoverageReport {
  leagueKey: string;
  providerLeagueId: string | null;
  name: string | null;
  country: string | null;
  /** The season the provider flags as current, when it flags one. */
  currentSeason: number | null;
  /** Highest season year the plan exposes, current or not. */
  latestSeason: number | null;
  seasons: SeasonCoverage[];
  /** True when at least one exposed season serves fixtures. */
  fixturesAvailable: boolean;
  /** Set when this competition could not be checked. */
  error: string | null;
}

/**
 * Allowance the provider reported, split into the two limits every feed has:
 * a daily quota and a shorter burst window. `null` means the provider did not
 * say — which is not the same as zero, and must never be treated as zero.
 */
export interface ProviderQuotaSnapshot {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  burstLimit: number | null;
  burstRemaining: number | null;
}

/**
 * The last response, described in provider-agnostic terms.
 *
 * This is what makes "why did the sync fail?" answerable from the admin screen
 * without opening a log: the status, the allowance, and the outcome that was
 * derived from them.
 */
export interface ProviderResponseReport {
  endpoint: string;
  status: number | null;
  /** `SUCCESS`, or the error code the call produced. */
  outcome: string;
  message: string | null;
  resultCount: number | null;
  snapshot: ProviderQuotaSnapshot;
  observedAt: Date;
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
  /**
   * Same fetch as `getFixtures`, reported rather than reduced.
   *
   * `getFixtures` throws away the two numbers an operator needs — what arrived
   * and what survived the filter — so the sync and the admin preview both go
   * through this instead and derive the bundles from it.
   */
  inspectFixtures(query: FixtureQuery): Promise<FixtureInspection>;
  /**
   * Season and coverage diagnostic for the configured competitions.
   *
   * Read-only and self-describing: it answers which seasons the plan actually
   * exposes today, so no part of the codebase has to assume a season range.
   */
  getLeagueCoverage(leagues?: LeagueKey[]): Promise<LeagueCoverageReport[]>;
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

  /**
   * What the most recent response revealed about the allowance, when the
   * adapter is able to say. Optional: a provider that exposes no quota
   * information is still a valid provider.
   */
  lastResponse?(): ProviderResponseReport | null;
}
