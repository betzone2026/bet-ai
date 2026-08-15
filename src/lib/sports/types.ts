/**
 * SportAlpha's own sports-data vocabulary.
 *
 * Nothing in this file references a vendor. Every provider adapter is
 * responsible for translating its wire format into these shapes, so the
 * database, the internal API, the dashboard and the future Quant Engine only
 * ever see SportAlpha models. Adding Sportmonks, Opta or StatsBomb later means
 * writing one more adapter — not touching anything downstream of it.
 *
 * Every optional measurement is `null` rather than absent or zero: a missing
 * statistic and a statistic that happens to be zero are different facts, and
 * the model layer must be able to tell them apart. Never substitute a guess.
 */

/** Identifier of the upstream feed a record came from, e.g. `api-football`. */
export type ProviderName = string;

/** Normalised fixture lifecycle. Provider-specific codes map onto these. */
export type FixtureStatus =
  | 'scheduled'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'canceled'
  | 'unknown';

/**
 * How much the Quant Engine should trust a fixture's data.
 *
 * - `GOOD`    — everything required is present and internally consistent.
 * - `PARTIAL` — usable, but something optional is missing (no odds, no stats).
 * - `STALE`   — was fine when written, has since aged past its TTL.
 * - `INVALID` — failed a hard check (impossible score, unusable kickoff).
 *
 * `PARTIAL` rows are still stored. Refusing to persist incomplete data would
 * lose the parts that are correct; flagging it lets consumers decide.
 */
export type DataQualityStatus = 'GOOD' | 'PARTIAL' | 'STALE' | 'INVALID';

/** A single, machine-readable reason a record is not `GOOD`. */
export type DataQualityIssue =
  | 'missing_teams'
  | 'missing_league'
  | 'invalid_kickoff'
  | 'duplicate_fixture'
  | 'impossible_score'
  | 'stale_statistics'
  | 'missing_odds'
  | 'missing_statistics';

export interface DataQualityReport {
  status: DataQualityStatus;
  issues: DataQualityIssue[];
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface League {
  /** Internal id, stable across syncs: `<providerPrefix>-<providerId>`. */
  id: string;
  provider: ProviderName;
  providerId: string;
  name: string;
  country: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  /** `league`, `cup`, or whatever the feed reports, lowercased. */
  type: string | null;
  active: boolean;
  /** SportAlpha's own key from `SUPPORTED_LEAGUES`, when the league is one. */
  slug: string | null;
}

export interface Season {
  id: string;
  leagueId: string;
  year: number;
  startDate: string | null; // ISO date, no time component
  endDate: string | null;
  current: boolean;
}

export interface Team {
  id: string;
  provider: ProviderName;
  providerId: string;
  name: string;
  code: string | null;
  country: string | null;
  logoUrl: string | null;
  founded: number | null;
  venueName: string | null;
}

export interface Fixture {
  id: string;
  provider: ProviderName;
  providerId: string;
  leagueId: string;
  season: number;
  homeTeamId: string;
  awayTeamId: string;
  /** ISO 8601 instant. */
  kickoff: string;
  timezone: string | null;
  status: FixtureStatus;
  /** Minutes played, only meaningful while live. */
  elapsed: number | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  referee: string | null;
  round: string | null;
  updatedAt: string;
}

/**
 * A fixture together with the entities it depends on.
 *
 * Feeds return fixtures with their league and teams embedded, and the fixture
 * row cannot be written before those exist. Carrying them together keeps the
 * adapter honest about what one call actually yields.
 */
export interface FixtureBundle {
  fixture: Fixture;
  league: League;
  season: Season | null;
  homeTeam: Team;
  awayTeam: Team;
}

// ---------------------------------------------------------------------------
// Match detail
// ---------------------------------------------------------------------------

/** One side's match statistics. `null` means the feed did not report it. */
export interface TeamMatchStatistics {
  shotsOnGoal: number | null;
  shotsOffGoal: number | null;
  totalShots: number | null;
  blockedShots: number | null;
  shotsInsideBox: number | null;
  shotsOutsideBox: number | null;
  fouls: number | null;
  corners: number | null;
  offsides: number | null;
  /** Percentage of the ball, 0–100. */
  possession: number | null;
  yellowCards: number | null;
  redCards: number | null;
  goalkeeperSaves: number | null;
  passes: number | null;
  passesAccurate: number | null;
  passesPercentage: number | null;
  /**
   * Expected goals as published by the feed. Never derived, never estimated —
   * if the provider does not send it, this stays `null`.
   */
  expectedGoals: number | null;
}

export interface FixtureStatistics {
  fixtureId: string;
  home: TeamMatchStatistics;
  away: TeamMatchStatistics;
  updatedAt: string;
}

export interface Standing {
  leagueId: string;
  season: number;
  teamId: string;
  rank: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Recent results as reported, e.g. `WWDLW`. */
  form: string | null;
  homeRecord: StandingRecord | null;
  awayRecord: StandingRecord | null;
  /** Group label for competitions that have one (`Group A`), else `null`. */
  group: string | null;
  updatedAt: string;
}

export interface StandingRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface LineupPlayer {
  playerId: string | null;
  name: string;
  number: number | null;
  position: string | null;
  /** Pitch coordinates as reported by the feed, e.g. `4:2`. */
  grid: string | null;
}

export interface Lineup {
  fixtureId: string;
  teamId: string;
  formation: string | null;
  coach: string | null;
  startingXI: LineupPlayer[];
  substitutes: LineupPlayer[];
  /**
   * Whether this is the officially announced XI rather than a projection.
   * Feeds only publish lineups close to kickoff, so an early read is a guess.
   */
  confirmed: boolean;
  updatedAt: string;
}

export interface Injury {
  id: string;
  playerId: string | null;
  playerName: string;
  teamId: string;
  fixtureId: string | null;
  /** Feed's classification, e.g. `Missing Fixture` / `Questionable`. */
  type: string | null;
  reason: string | null;
  status: string | null;
  updatedAt: string;
}

/**
 * One observation of one price at one instant.
 *
 * Odds are append-only by design. Overwriting the previous price would destroy
 * the line movement that later phases need for closing-line comparison,
 * backtesting and value detection, so every capture is a new row.
 */
export interface OddsSnapshot {
  fixtureId: string;
  provider: ProviderName;
  bookmaker: string;
  /** Market label, e.g. `Match Winner`, `Over/Under`. */
  market: string;
  /** Selection within the market, e.g. `Home`, `Over 2.5`. */
  selection: string;
  decimalOdds: number;
  capturedAt: string;
}

export interface HeadToHead {
  homeTeamId: string;
  awayTeamId: string;
  fixtures: FixtureBundle[];
}
