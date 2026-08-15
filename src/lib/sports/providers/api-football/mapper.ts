/**
 * Translation layer: API-Football wire shapes → SportAlpha models.
 *
 * Every function here is pure and total. Anything unusable returns `null` or is
 * omitted rather than being patched up with a plausible-looking default — a
 * fabricated statistic is worse than a missing one, because the Quant Engine
 * cannot tell it apart from a real measurement.
 *
 * Pure and dependency-free apart from configuration constants, so the mapping
 * rules can be exercised directly in tests without any network.
 */

import { internalId, leagueKeyForProviderId } from '../../config.ts';
import type {
  Fixture,
  FixtureBundle,
  FixtureStatistics,
  FixtureStatus,
  Injury,
  League,
  Lineup,
  LineupPlayer,
  OddsSnapshot,
  Season,
  Standing,
  StandingRecord,
  Team,
  TeamMatchStatistics,
} from '../../types.ts';
import { API_FOOTBALL_PROVIDER } from './client.ts';
import type {
  ApiFootballFixtureEntry,
  ApiFootballInjuryEntry,
  ApiFootballLeagueEntry,
  ApiFootballLineupEntry,
  ApiFootballLineupPlayer,
  ApiFootballOddsEntry,
  ApiFootballStandingRow,
  ApiFootballStandingSplit,
  ApiFootballStandingsEntry,
  ApiFootballStatisticsEntry,
  ApiFootballTeamEntry,
} from './types.ts';

const PROVIDER = API_FOOTBALL_PROVIDER;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function integer(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Math.round(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace('%', '').trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function decimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace('%', '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isoInstant(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const at = new Date(raw);
  if (!Number.isFinite(at.getTime())) return null;
  return at.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * API-Football's short status codes, collapsed onto SportAlpha's lifecycle.
 *
 * Anything unrecognised becomes `unknown` rather than being guessed into
 * `scheduled`: a fixture whose state we cannot read is not the same as one that
 * has not started.
 */
const STATUS_BY_CODE: Record<string, FixtureStatus> = {
  TBD: 'scheduled',
  NS: 'scheduled',
  '1H': 'live',
  HT: 'live',
  '2H': 'live',
  ET: 'live',
  BT: 'live',
  P: 'live',
  SUSP: 'live',
  INT: 'live',
  LIVE: 'live',
  FT: 'finished',
  AET: 'finished',
  PEN: 'finished',
  AWD: 'finished',
  WO: 'finished',
  PST: 'postponed',
  CANC: 'canceled',
  ABD: 'canceled',
};

export function mapFixtureStatus(code: string | null | undefined): FixtureStatus {
  if (!code) return 'unknown';
  return STATUS_BY_CODE[code.toUpperCase()] ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Leagues, seasons, teams
// ---------------------------------------------------------------------------

export function mapLeague(entry: ApiFootballLeagueEntry): League | null {
  const providerId = entry.league?.id;
  const name = text(entry.league?.name);
  if (providerId === undefined || providerId === null || !name) return null;

  return {
    id: internalId(PROVIDER, providerId),
    provider: PROVIDER,
    providerId: String(providerId),
    name,
    country: text(entry.country?.name),
    countryCode: text(entry.country?.code),
    logoUrl: text(entry.league?.logo),
    type: text(entry.league?.type)?.toLowerCase() ?? null,
    active: true,
    slug: leagueKeyForProviderId(PROVIDER, String(providerId)),
  };
}

export function mapSeasons(entry: ApiFootballLeagueEntry): Season[] {
  const league = mapLeague(entry);
  if (!league) return [];

  return (entry.seasons ?? []).flatMap((season) => {
    const year = integer(season.year);
    if (year === null) return [];
    return [
      {
        id: `${league.id}-${year}`,
        leagueId: league.id,
        year,
        startDate: isoDate(season.start),
        endDate: isoDate(season.end),
        current: season.current === true,
      } satisfies Season,
    ];
  });
}

export function mapTeam(entry: ApiFootballTeamEntry): Team | null {
  const providerId = entry.team?.id;
  const name = text(entry.team?.name);
  if (providerId === undefined || providerId === null || !name) return null;

  return {
    id: internalId(PROVIDER, providerId),
    provider: PROVIDER,
    providerId: String(providerId),
    name,
    code: text(entry.team?.code),
    country: text(entry.team?.country),
    logoUrl: text(entry.team?.logo),
    founded: integer(entry.team?.founded),
    venueName: text(entry.venue?.name),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a fixture and the league and teams it depends on.
 *
 * The fixtures endpoint embeds all three, so this is the only place they are
 * produced together — and returning them as one bundle is what lets the sync
 * service write parents before children without a second round-trip.
 */
export function mapFixtureBundle(
  entry: ApiFootballFixtureEntry,
  observedAt: Date = new Date(),
): FixtureBundle | null {
  const providerId = entry.fixture?.id;
  const kickoff = isoInstant(entry.fixture?.date);
  const leagueProviderId = entry.league?.id;
  const homeProviderId = entry.teams?.home?.id;
  const awayProviderId = entry.teams?.away?.id;

  if (
    providerId === undefined || providerId === null ||
    !kickoff ||
    leagueProviderId === undefined || leagueProviderId === null ||
    homeProviderId === undefined || homeProviderId === null ||
    awayProviderId === undefined || awayProviderId === null
  ) {
    return null;
  }

  const league: League = {
    id: internalId(PROVIDER, leagueProviderId),
    provider: PROVIDER,
    providerId: String(leagueProviderId),
    name: text(entry.league?.name) ?? `League ${leagueProviderId}`,
    country: text(entry.league?.country),
    countryCode: null,
    logoUrl: text(entry.league?.logo),
    type: null,
    active: true,
    slug: leagueKeyForProviderId(PROVIDER, String(leagueProviderId)),
  };

  const season = integer(entry.league?.season);

  const homeTeam: Team = {
    id: internalId(PROVIDER, homeProviderId),
    provider: PROVIDER,
    providerId: String(homeProviderId),
    name: text(entry.teams?.home?.name) ?? `Team ${homeProviderId}`,
    code: null,
    country: null,
    logoUrl: text(entry.teams?.home?.logo),
    founded: null,
    venueName: null,
  };

  const awayTeam: Team = {
    id: internalId(PROVIDER, awayProviderId),
    provider: PROVIDER,
    providerId: String(awayProviderId),
    name: text(entry.teams?.away?.name) ?? `Team ${awayProviderId}`,
    code: null,
    country: null,
    logoUrl: text(entry.teams?.away?.logo),
    founded: null,
    venueName: null,
  };

  const status = mapFixtureStatus(entry.fixture?.status?.short);

  const fixture: Fixture = {
    id: internalId(PROVIDER, providerId),
    provider: PROVIDER,
    providerId: String(providerId),
    leagueId: league.id,
    season: season ?? new Date(kickoff).getUTCFullYear(),
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    kickoff,
    timezone: text(entry.fixture?.timezone),
    status,
    elapsed: status === 'live' ? integer(entry.fixture?.status?.elapsed) : null,
    homeScore: integer(entry.goals?.home),
    awayScore: integer(entry.goals?.away),
    venue: text(entry.fixture?.venue?.name),
    referee: text(entry.fixture?.referee),
    round: text(entry.league?.round),
    updatedAt: observedAt.toISOString(),
  };

  return {
    fixture,
    league,
    season:
      season === null
        ? null
        : {
            id: `${league.id}-${season}`,
            leagueId: league.id,
            year: season,
            startDate: null,
            endDate: null,
            current: false,
          },
    homeTeam,
    awayTeam,
  };
}

// ---------------------------------------------------------------------------
// Fixture statistics
// ---------------------------------------------------------------------------

/** Empty statistics: every measurement explicitly absent. */
export function emptyTeamStatistics(): TeamMatchStatistics {
  return {
    shotsOnGoal: null,
    shotsOffGoal: null,
    totalShots: null,
    blockedShots: null,
    shotsInsideBox: null,
    shotsOutsideBox: null,
    fouls: null,
    corners: null,
    offsides: null,
    possession: null,
    yellowCards: null,
    redCards: null,
    goalkeeperSaves: null,
    passes: null,
    passesAccurate: null,
    passesPercentage: null,
    expectedGoals: null,
  };
}

/** Feed label, lowercased with punctuation and spaces removed. */
function statKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Feed label → model field.
 *
 * Note the two pass entries: `Total passes` normalises to `totalpasses`, while
 * `Passes %` normalises to the bare `passes` — so the percentage, not the
 * count, is what `passes` maps to here.
 */
const STAT_FIELDS: Record<string, keyof TeamMatchStatistics> = {
  shotsongoal: 'shotsOnGoal',
  shotsoffgoal: 'shotsOffGoal',
  totalshots: 'totalShots',
  blockedshots: 'blockedShots',
  shotsinsidebox: 'shotsInsideBox',
  shotsoutsidebox: 'shotsOutsideBox',
  fouls: 'fouls',
  cornerkicks: 'corners',
  corners: 'corners',
  offsides: 'offsides',
  ballpossession: 'possession',
  yellowcards: 'yellowCards',
  redcards: 'redCards',
  goalkeepersaves: 'goalkeeperSaves',
  totalpasses: 'passes',
  passesaccurate: 'passesAccurate',
  passes: 'passesPercentage',
  expectedgoals: 'expectedGoals',
};

/** Fields carrying a fractional measurement rather than a count. */
const DECIMAL_FIELDS: ReadonlySet<keyof TeamMatchStatistics> = new Set([
  'possession',
  'passesPercentage',
  'expectedGoals',
]);

function mapTeamStatistics(entry: ApiFootballStatisticsEntry): TeamMatchStatistics {
  const stats = emptyTeamStatistics();

  for (const item of entry.statistics ?? []) {
    const label = text(item.type);
    if (!label) continue;
    const field = STAT_FIELDS[statKey(label)];
    if (!field) continue;
    // `null` from the feed means "not measured" and must stay null.
    if (item.value === null || item.value === undefined || item.value === '') continue;

    const value = DECIMAL_FIELDS.has(field) ? decimal(item.value) : integer(item.value);
    if (value === null) continue;
    stats[field] = value;
  }

  return stats;
}

/**
 * Assembles both sides for one fixture.
 *
 * Which entry is home is decided by the caller's team ids, not by array order:
 * the feed's ordering is not documented as stable, and getting it backwards
 * would silently invert every statistic in the database.
 */
export function mapFixtureStatistics(
  fixtureId: string,
  entries: ApiFootballStatisticsEntry[],
  homeProviderTeamId: string,
  awayProviderTeamId: string,
  observedAt: Date = new Date(),
): FixtureStatistics | null {
  if (entries.length === 0) return null;

  const home = entries.find((entry) => String(entry.team?.id ?? '') === String(homeProviderTeamId));
  const away = entries.find((entry) => String(entry.team?.id ?? '') === String(awayProviderTeamId));
  if (!home && !away) return null;

  return {
    fixtureId,
    home: home ? mapTeamStatistics(home) : emptyTeamStatistics(),
    away: away ? mapTeamStatistics(away) : emptyTeamStatistics(),
    updatedAt: observedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

function mapRecord(split: ApiFootballStandingSplit | undefined): StandingRecord | null {
  if (!split) return null;
  return {
    played: integer(split.played) ?? 0,
    wins: integer(split.win) ?? 0,
    draws: integer(split.draw) ?? 0,
    losses: integer(split.lose) ?? 0,
    goalsFor: integer(split.goals?.for) ?? 0,
    goalsAgainst: integer(split.goals?.against) ?? 0,
  };
}

function mapStandingRow(
  row: ApiFootballStandingRow,
  leagueId: string,
  season: number,
  observedAt: Date,
): Standing | null {
  const teamProviderId = row.team?.id;
  const rank = integer(row.rank);
  if (teamProviderId === undefined || teamProviderId === null || rank === null) return null;

  const all = mapRecord(row.all);
  const goalsFor = all?.goalsFor ?? 0;
  const goalsAgainst = all?.goalsAgainst ?? 0;

  return {
    leagueId,
    season,
    teamId: internalId(PROVIDER, teamProviderId),
    rank,
    points: integer(row.points) ?? 0,
    played: all?.played ?? 0,
    wins: all?.wins ?? 0,
    draws: all?.draws ?? 0,
    losses: all?.losses ?? 0,
    goalsFor,
    goalsAgainst,
    goalDifference: integer(row.goalsDiff) ?? goalsFor - goalsAgainst,
    form: text(row.form),
    homeRecord: mapRecord(row.home),
    awayRecord: mapRecord(row.away),
    group: text(row.group),
    updatedAt: observedAt.toISOString(),
  };
}

/** Flattens the feed's group-of-rows nesting into one row per team. */
export function mapStandings(
  entry: ApiFootballStandingsEntry,
  observedAt: Date = new Date(),
): Standing[] {
  const leagueProviderId = entry.league?.id;
  const season = integer(entry.league?.season);
  if (leagueProviderId === undefined || leagueProviderId === null || season === null) return [];

  const leagueId = internalId(PROVIDER, leagueProviderId);
  return (entry.league?.standings ?? []).flatMap((group) =>
    group.flatMap((row) => {
      const mapped = mapStandingRow(row, leagueId, season, observedAt);
      return mapped ? [mapped] : [];
    }),
  );
}

// ---------------------------------------------------------------------------
// Lineups and injuries
// ---------------------------------------------------------------------------

function mapLineupPlayer(player: ApiFootballLineupPlayer | undefined): LineupPlayer | null {
  const name = text(player?.name);
  if (!name) return null;
  return {
    playerId: player?.id === undefined || player?.id === null ? null : internalId(PROVIDER, player.id),
    name,
    number: integer(player?.number),
    position: text(player?.pos),
    grid: text(player?.grid),
  };
}

/**
 * `confirmed` reflects whether the feed published an actual XI. Before a club
 * releases its team sheet the endpoint returns nothing, so a lineup with eleven
 * named starters is the official one; anything shorter is treated as partial.
 */
export function mapLineup(
  fixtureId: string,
  entry: ApiFootballLineupEntry,
  observedAt: Date = new Date(),
): Lineup | null {
  const teamProviderId = entry.team?.id;
  if (teamProviderId === undefined || teamProviderId === null) return null;

  const startingXI = (entry.startXI ?? []).flatMap((slot) => {
    const player = mapLineupPlayer(slot.player);
    return player ? [player] : [];
  });
  const substitutes = (entry.substitutes ?? []).flatMap((slot) => {
    const player = mapLineupPlayer(slot.player);
    return player ? [player] : [];
  });

  return {
    fixtureId,
    teamId: internalId(PROVIDER, teamProviderId),
    formation: text(entry.formation),
    coach: text(entry.coach?.name),
    startingXI,
    substitutes,
    confirmed: startingXI.length === 11,
    updatedAt: observedAt.toISOString(),
  };
}

export function mapInjury(
  entry: ApiFootballInjuryEntry,
  observedAt: Date = new Date(),
): Injury | null {
  const teamProviderId = entry.team?.id;
  const playerName = text(entry.player?.name);
  if (teamProviderId === undefined || teamProviderId === null || !playerName) return null;

  const playerId =
    entry.player?.id === undefined || entry.player?.id === null
      ? null
      : internalId(PROVIDER, entry.player.id);
  const fixtureId =
    entry.fixture?.id === undefined || entry.fixture?.id === null
      ? null
      : internalId(PROVIDER, entry.fixture.id);

  return {
    // Deterministic so a re-sync updates the row instead of duplicating it.
    id: `${playerId ?? statKey(playerName)}-${fixtureId ?? 'nofixture'}`,
    playerId,
    playerName,
    teamId: internalId(PROVIDER, teamProviderId),
    fixtureId,
    type: text(entry.player?.type),
    reason: text(entry.player?.reason),
    status: text(entry.player?.type),
    updatedAt: observedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Odds
// ---------------------------------------------------------------------------

/**
 * Flattens bookmaker → market → selection into one snapshot per price.
 *
 * `capturedAt` is the observation time, not the feed's `update` field: what
 * matters for line movement is when SportAlpha saw the number.
 */
export function mapOdds(
  fixtureId: string,
  entry: ApiFootballOddsEntry,
  capturedAt: Date = new Date(),
): OddsSnapshot[] {
  const snapshots: OddsSnapshot[] = [];
  const at = capturedAt.toISOString();

  for (const bookmaker of entry.bookmakers ?? []) {
    const bookmakerName = text(bookmaker.name);
    if (!bookmakerName) continue;

    for (const bet of bookmaker.bets ?? []) {
      const market = text(bet.name);
      if (!market) continue;

      for (const value of bet.values ?? []) {
        const selection = text(String(value.value ?? ''));
        const decimalOdds = decimal(value.odd);
        if (!selection || decimalOdds === null) continue;

        snapshots.push({
          fixtureId,
          provider: PROVIDER,
          bookmaker: bookmakerName,
          market,
          selection,
          decimalOdds,
          capturedAt: at,
        });
      }
    }
  }

  return snapshots;
}
