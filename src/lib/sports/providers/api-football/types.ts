/**
 * API-Football (v3) wire shapes.
 *
 * These describe what the vendor sends, nothing more. They exist so the mapper
 * has something typed to read from; no other part of SportAlpha imports them.
 * Fields are optional across the board because the feed omits sections a plan
 * downgrade no longer covers, and identifiers may arrive explicitly null on
 * placeholder entries — the mapper rejects those rather than trusting them.
 */

/** Every v3 endpoint answers with this envelope. */
export interface ApiFootballEnvelope<T> {
  get?: string;
  parameters?: Record<string, unknown>;
  /** Empty array when fine; object of `field -> message` when not. */
  errors?: string[] | Record<string, string>;
  results?: number;
  paging?: { current?: number; total?: number };
  response?: T[];
}

export interface ApiFootballLeagueEntry {
  league?: {
    id?: number | null;
    name?: string;
    type?: string;
    logo?: string;
  };
  country?: {
    name?: string;
    code?: string | null;
    flag?: string | null;
  };
  seasons?: Array<{
    year?: number;
    start?: string;
    end?: string;
    current?: boolean;
    /**
     * What the caller's plan serves for this season.
     *
     * The only authoritative answer to "does the Free plan cover 2026?" — which
     * is why the season diagnostic reads it instead of assuming a range.
     */
    coverage?: ApiFootballCoverage;
  }>;
}

export interface ApiFootballCoverage {
  fixtures?: {
    events?: boolean;
    lineups?: boolean;
    statistics_fixtures?: boolean;
    statistics_players?: boolean;
  };
  standings?: boolean;
  players?: boolean;
  top_scorers?: boolean;
  top_assists?: boolean;
  top_cards?: boolean;
  injuries?: boolean;
  predictions?: boolean;
  odds?: boolean;
}

export interface ApiFootballTeamEntry {
  team?: {
    id?: number | null;
    name?: string;
    code?: string | null;
    country?: string | null;
    founded?: number | null;
    logo?: string | null;
  };
  venue?: {
    name?: string | null;
    city?: string | null;
  };
}

export interface ApiFootballFixtureEntry {
  fixture?: {
    id?: number | null;
    referee?: string | null;
    timezone?: string;
    date?: string;
    timestamp?: number;
    venue?: { id?: number | null; name?: string | null; city?: string | null };
    status?: { long?: string; short?: string; elapsed?: number | null };
  };
  league?: {
    id?: number | null;
    name?: string;
    country?: string;
    logo?: string | null;
    flag?: string | null;
    season?: number;
    round?: string;
  };
  teams?: {
    home?: { id?: number | null; name?: string; logo?: string | null; winner?: boolean | null };
    away?: { id?: number | null; name?: string; logo?: string | null; winner?: boolean | null };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
}

export interface ApiFootballStatisticsEntry {
  team?: { id?: number | null; name?: string; logo?: string | null };
  /** `[{ type: 'Shots on Goal', value: 5 }, ...]`; value may be `"54%"`. */
  statistics?: Array<{ type?: string; value?: number | string | null }>;
}

export interface ApiFootballStandingsEntry {
  league?: {
    id?: number | null;
    name?: string;
    season?: number;
    /** Outer array is one group; inner array is the rows in it. */
    standings?: ApiFootballStandingRow[][];
  };
}

export interface ApiFootballStandingRow {
  rank?: number;
  team?: { id?: number | null; name?: string; logo?: string | null };
  points?: number;
  goalsDiff?: number;
  group?: string;
  form?: string | null;
  status?: string;
  description?: string | null;
  all?: ApiFootballStandingSplit;
  home?: ApiFootballStandingSplit;
  away?: ApiFootballStandingSplit;
  update?: string;
}

export interface ApiFootballStandingSplit {
  played?: number;
  win?: number;
  draw?: number;
  lose?: number;
  goals?: { for?: number; against?: number };
}

export interface ApiFootballLineupEntry {
  team?: { id?: number | null; name?: string; colors?: unknown };
  coach?: { id?: number | null; name?: string | null };
  formation?: string | null;
  startXI?: Array<{ player?: ApiFootballLineupPlayer }>;
  substitutes?: Array<{ player?: ApiFootballLineupPlayer }>;
}

export interface ApiFootballLineupPlayer {
  id?: number | null;
  name?: string;
  number?: number | null;
  pos?: string | null;
  grid?: string | null;
}

export interface ApiFootballInjuryEntry {
  player?: {
    id?: number | null;
    name?: string;
    type?: string | null;
    reason?: string | null;
  };
  team?: { id?: number | null; name?: string };
  fixture?: { id?: number | null; date?: string };
  league?: { id?: number | null; season?: number };
}

export interface ApiFootballOddsEntry {
  fixture?: { id?: number | null; date?: string };
  update?: string;
  bookmakers?: Array<{
    id?: number | null;
    name?: string;
    bets?: Array<{
      id?: number | null;
      name?: string;
      values?: Array<{ value?: string | number; odd?: string | number }>;
    }>;
  }>;
}
