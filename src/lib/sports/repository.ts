/**
 * Persistence and read access for sports data.
 *
 * Everything that touches the sports tables goes through here, which is what
 * keeps the write path (sync services) and the read path (internal API,
 * dashboard, admin) from drifting into two different ideas of the same row.
 *
 * Writes are upserts keyed on the provider unique constraints, so re-running a
 * sync is idempotent: the same fixture arrives twice and updates once.
 */

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/../db';
import {
  fixtureStatistics as fixtureStatisticsTable,
  injuries as injuriesTable,
  lineups as lineupsTable,
  oddsSnapshots,
  sportsFixtures,
  sportsLeagues,
  sportsSeasons,
  sportsTeams,
  standings as standingsTable,
} from '@/../db/schema';
import { selectNewSnapshots } from './odds.ts';
import { partitionFixtures, type StoredFixtureComparable } from './diff.ts';
import type {
  DataQualityIssue,
  DataQualityStatus,
  Fixture,
  FixtureStatistics,
  Injury,
  League,
  Lineup,
  OddsSnapshot,
  Season,
  Standing,
  Team,
} from './types.ts';

export interface WriteCounts {
  inserted: number;
  updated: number;
  /** Rows that arrived identical to what was stored, so nothing was written. */
  unchanged: number;
}

const NO_WRITES: WriteCounts = { inserted: 0, updated: 0, unchanged: 0 };

/** Splits a batch into rows that already exist and rows that do not. */
async function classify(
  table: typeof sportsLeagues | typeof sportsTeams | typeof sportsFixtures,
  ids: string[],
): Promise<WriteCounts> {
  if (ids.length === 0) return NO_WRITES;
  const existing = await db
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, ids));
  const updated = existing.length;
  return { inserted: ids.length - updated, updated, unchanged: 0 };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function upsertLeagues(leagues: League[]): Promise<WriteCounts> {
  if (leagues.length === 0) return NO_WRITES;
  const counts = await classify(sportsLeagues, leagues.map((league) => league.id));

  await db
    .insert(sportsLeagues)
    .values(
      leagues.map((league) => ({
        id: league.id,
        provider: league.provider,
        providerId: league.providerId,
        name: league.name,
        country: league.country,
        countryCode: league.countryCode,
        logoUrl: league.logoUrl,
        type: league.type,
        slug: league.slug,
        active: league.active,
      })),
    )
    .onConflictDoUpdate({
      target: sportsLeagues.id,
      set: {
        name: sql`excluded.name`,
        country: sql`excluded.country`,
        countryCode: sql`excluded.country_code`,
        logoUrl: sql`excluded.logo_url`,
        // A later, thinner payload must not erase a known type or slug.
        type: sql`coalesce(excluded.type, ${sportsLeagues.type})`,
        slug: sql`coalesce(excluded.slug, ${sportsLeagues.slug})`,
        active: sql`excluded.active`,
        updatedAt: new Date(),
      },
    });

  return counts;
}

export async function upsertSeasons(seasons: Season[]): Promise<void> {
  if (seasons.length === 0) return;
  await db
    .insert(sportsSeasons)
    .values(
      seasons.map((season) => ({
        id: season.id,
        leagueId: season.leagueId,
        year: season.year,
        startDate: season.startDate,
        endDate: season.endDate,
        current: season.current,
      })),
    )
    .onConflictDoUpdate({
      target: sportsSeasons.id,
      set: {
        startDate: sql`coalesce(excluded.start_date, ${sportsSeasons.startDate})`,
        endDate: sql`coalesce(excluded.end_date, ${sportsSeasons.endDate})`,
        current: sql`excluded.current`,
        updatedAt: new Date(),
      },
    });
}

export async function upsertTeams(teams: Team[]): Promise<WriteCounts> {
  if (teams.length === 0) return NO_WRITES;

  // The fixtures endpoint reports teams twice (home and away across fixtures);
  // Postgres rejects a statement that touches the same key twice.
  const unique = [...new Map(teams.map((team) => [team.id, team])).values()];
  const counts = await classify(sportsTeams, unique.map((team) => team.id));

  await db
    .insert(sportsTeams)
    .values(
      unique.map((team) => ({
        id: team.id,
        provider: team.provider,
        providerId: team.providerId,
        name: team.name,
        code: team.code,
        country: team.country,
        logoUrl: team.logoUrl,
        founded: team.founded,
        venueName: team.venueName,
      })),
    )
    .onConflictDoUpdate({
      target: sportsTeams.id,
      set: {
        name: sql`excluded.name`,
        // Fixture payloads carry only id, name and logo. Keeping the richer
        // values already stored is the difference between enriching a team and
        // hollowing it out on every sync.
        code: sql`coalesce(excluded.code, ${sportsTeams.code})`,
        country: sql`coalesce(excluded.country, ${sportsTeams.country})`,
        logoUrl: sql`coalesce(excluded.logo_url, ${sportsTeams.logoUrl})`,
        founded: sql`coalesce(excluded.founded, ${sportsTeams.founded})`,
        venueName: sql`coalesce(excluded.venue_name, ${sportsTeams.venueName})`,
        updatedAt: new Date(),
      },
    });

  return counts;
}

export interface FixtureWrite {
  fixture: Fixture;
  quality: DataQualityStatus;
  issues: DataQualityIssue[];
}

/**
 * Writes a batch of fixtures, reporting what each one actually did.
 *
 * Re-syncing a date is expected — an admin checks a day, syncs it, then syncs
 * it again after the matches finish — so the interesting question is not "did
 * it insert or update?" but "did anything change?". Rows whose content is
 * identical to what is stored are counted as `unchanged` and excluded from the
 * statement entirely, which keeps `updated_at` meaningful and makes a repeated
 * sync of a settled day a read rather than a rewrite.
 *
 * Duplicates are impossible either way: the primary key is
 * `<provider>-<providerFixtureId>` and `(provider, provider_id)` is unique, so
 * the same fixture from the same provider is always the same row.
 */
export async function upsertFixtures(writes: FixtureWrite[]): Promise<WriteCounts> {
  if (writes.length === 0) return NO_WRITES;

  const ids = [...new Set(writes.map((write) => write.fixture.id))];
  const existing = await db
    .select({
      id: sportsFixtures.id,
      leagueId: sportsFixtures.leagueId,
      season: sportsFixtures.season,
      homeTeamId: sportsFixtures.homeTeamId,
      awayTeamId: sportsFixtures.awayTeamId,
      kickoff: sportsFixtures.kickoff,
      timezone: sportsFixtures.timezone,
      status: sportsFixtures.status,
      elapsed: sportsFixtures.elapsed,
      homeScore: sportsFixtures.homeScore,
      awayScore: sportsFixtures.awayScore,
      venue: sportsFixtures.venue,
      referee: sportsFixtures.referee,
      round: sportsFixtures.round,
      dataQuality: sportsFixtures.dataQuality,
      qualityIssues: sportsFixtures.qualityIssues,
    })
    .from(sportsFixtures)
    .where(inArray(sportsFixtures.id, ids));

  const stored = new Map<string, StoredFixtureComparable>(
    existing.map((row) => [row.id, row]),
  );
  const partition = partitionFixtures(writes, stored);

  if (partition.write.length === 0) {
    return {
      inserted: partition.inserted,
      updated: partition.updated,
      unchanged: partition.unchanged,
    };
  }

  await db
    .insert(sportsFixtures)
    .values(
      partition.write.map(({ fixture, quality, issues }) => ({
        id: fixture.id,
        provider: fixture.provider,
        providerId: fixture.providerId,
        leagueId: fixture.leagueId,
        season: fixture.season,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        kickoff: new Date(fixture.kickoff),
        timezone: fixture.timezone,
        status: fixture.status,
        elapsed: fixture.elapsed,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        venue: fixture.venue,
        referee: fixture.referee,
        round: fixture.round,
        dataQuality: quality,
        qualityIssues: issues,
        providerStatus: fixture.status,
      })),
    )
    .onConflictDoUpdate({
      target: sportsFixtures.id,
      set: {
        leagueId: sql`excluded.league_id`,
        season: sql`excluded.season`,
        homeTeamId: sql`excluded.home_team_id`,
        awayTeamId: sql`excluded.away_team_id`,
        kickoff: sql`excluded.kickoff`,
        timezone: sql`excluded.timezone`,
        status: sql`excluded.status`,
        elapsed: sql`excluded.elapsed`,
        homeScore: sql`excluded.home_score`,
        awayScore: sql`excluded.away_score`,
        venue: sql`coalesce(excluded.venue, ${sportsFixtures.venue})`,
        referee: sql`coalesce(excluded.referee, ${sportsFixtures.referee})`,
        round: sql`coalesce(excluded.round, ${sportsFixtures.round})`,
        dataQuality: sql`excluded.data_quality`,
        qualityIssues: sql`excluded.quality_issues`,
        providerStatus: sql`excluded.provider_status`,
        updatedAt: new Date(),
      },
    });

  return {
    inserted: partition.inserted,
    updated: partition.updated,
    unchanged: partition.unchanged,
  };
}

export async function upsertFixtureStatistics(stats: FixtureStatistics): Promise<void> {
  await db
    .insert(fixtureStatisticsTable)
    .values({
      fixtureId: stats.fixtureId,
      homeShotsOnGoal: stats.home.shotsOnGoal,
      homeShotsOffGoal: stats.home.shotsOffGoal,
      homeTotalShots: stats.home.totalShots,
      homeBlockedShots: stats.home.blockedShots,
      homeShotsInsideBox: stats.home.shotsInsideBox,
      homeShotsOutsideBox: stats.home.shotsOutsideBox,
      homeFouls: stats.home.fouls,
      homeCorners: stats.home.corners,
      homeOffsides: stats.home.offsides,
      homePossession: stats.home.possession,
      homeYellowCards: stats.home.yellowCards,
      homeRedCards: stats.home.redCards,
      homeGoalkeeperSaves: stats.home.goalkeeperSaves,
      homePasses: stats.home.passes,
      homePassesAccurate: stats.home.passesAccurate,
      homePassesPercentage: stats.home.passesPercentage,
      homeExpectedGoals: stats.home.expectedGoals,
      awayShotsOnGoal: stats.away.shotsOnGoal,
      awayShotsOffGoal: stats.away.shotsOffGoal,
      awayTotalShots: stats.away.totalShots,
      awayBlockedShots: stats.away.blockedShots,
      awayShotsInsideBox: stats.away.shotsInsideBox,
      awayShotsOutsideBox: stats.away.shotsOutsideBox,
      awayFouls: stats.away.fouls,
      awayCorners: stats.away.corners,
      awayOffsides: stats.away.offsides,
      awayPossession: stats.away.possession,
      awayYellowCards: stats.away.yellowCards,
      awayRedCards: stats.away.redCards,
      awayGoalkeeperSaves: stats.away.goalkeeperSaves,
      awayPasses: stats.away.passes,
      awayPassesAccurate: stats.away.passesAccurate,
      awayPassesPercentage: stats.away.passesPercentage,
      awayExpectedGoals: stats.away.expectedGoals,
      updatedAt: new Date(stats.updatedAt),
    })
    .onConflictDoUpdate({
      target: fixtureStatisticsTable.fixtureId,
      set: {
        homeShotsOnGoal: sql`excluded.home_shots_on_goal`,
        homeShotsOffGoal: sql`excluded.home_shots_off_goal`,
        homeTotalShots: sql`excluded.home_total_shots`,
        homeBlockedShots: sql`excluded.home_blocked_shots`,
        homeShotsInsideBox: sql`excluded.home_shots_inside_box`,
        homeShotsOutsideBox: sql`excluded.home_shots_outside_box`,
        homeFouls: sql`excluded.home_fouls`,
        homeCorners: sql`excluded.home_corners`,
        homeOffsides: sql`excluded.home_offsides`,
        homePossession: sql`excluded.home_possession`,
        homeYellowCards: sql`excluded.home_yellow_cards`,
        homeRedCards: sql`excluded.home_red_cards`,
        homeGoalkeeperSaves: sql`excluded.home_goalkeeper_saves`,
        homePasses: sql`excluded.home_passes`,
        homePassesAccurate: sql`excluded.home_passes_accurate`,
        homePassesPercentage: sql`excluded.home_passes_percentage`,
        homeExpectedGoals: sql`excluded.home_expected_goals`,
        awayShotsOnGoal: sql`excluded.away_shots_on_goal`,
        awayShotsOffGoal: sql`excluded.away_shots_off_goal`,
        awayTotalShots: sql`excluded.away_total_shots`,
        awayBlockedShots: sql`excluded.away_blocked_shots`,
        awayShotsInsideBox: sql`excluded.away_shots_inside_box`,
        awayShotsOutsideBox: sql`excluded.away_shots_outside_box`,
        awayFouls: sql`excluded.away_fouls`,
        awayCorners: sql`excluded.away_corners`,
        awayOffsides: sql`excluded.away_offsides`,
        awayPossession: sql`excluded.away_possession`,
        awayYellowCards: sql`excluded.away_yellow_cards`,
        awayRedCards: sql`excluded.away_red_cards`,
        awayGoalkeeperSaves: sql`excluded.away_goalkeeper_saves`,
        awayPasses: sql`excluded.away_passes`,
        awayPassesAccurate: sql`excluded.away_passes_accurate`,
        awayPassesPercentage: sql`excluded.away_passes_percentage`,
        awayExpectedGoals: sql`excluded.away_expected_goals`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

export async function upsertStandings(rows: Standing[]): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(standingsTable)
    .values(
      rows.map((row) => ({
        id: `${row.leagueId}-${row.season}-${row.teamId}`,
        leagueId: row.leagueId,
        season: row.season,
        teamId: row.teamId,
        rank: row.rank,
        points: row.points,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        form: row.form,
        homeRecord: row.homeRecord,
        awayRecord: row.awayRecord,
        group: row.group,
        updatedAt: new Date(row.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: standingsTable.id,
      set: {
        rank: sql`excluded.rank`,
        points: sql`excluded.points`,
        played: sql`excluded.played`,
        wins: sql`excluded.wins`,
        draws: sql`excluded.draws`,
        losses: sql`excluded.losses`,
        goalsFor: sql`excluded.goals_for`,
        goalsAgainst: sql`excluded.goals_against`,
        goalDifference: sql`excluded.goal_difference`,
        form: sql`excluded.form`,
        homeRecord: sql`excluded.home_record`,
        awayRecord: sql`excluded.away_record`,
        group: sql`excluded.group`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

export async function upsertLineups(rows: Lineup[]): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(lineupsTable)
    .values(
      rows.map((row) => ({
        id: `${row.fixtureId}-${row.teamId}`,
        fixtureId: row.fixtureId,
        teamId: row.teamId,
        formation: row.formation,
        coach: row.coach,
        startingXi: row.startingXI,
        substitutes: row.substitutes,
        confirmed: row.confirmed,
        updatedAt: new Date(row.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: lineupsTable.id,
      set: {
        formation: sql`excluded.formation`,
        coach: sql`excluded.coach`,
        startingXi: sql`excluded.starting_xi`,
        substitutes: sql`excluded.substitutes`,
        confirmed: sql`excluded.confirmed`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

export async function upsertInjuries(rows: Injury[]): Promise<void> {
  if (rows.length === 0) return;
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  await db
    .insert(injuriesTable)
    .values(
      unique.map((row) => ({
        id: row.id,
        playerId: row.playerId,
        playerName: row.playerName,
        teamId: row.teamId,
        fixtureId: row.fixtureId,
        type: row.type,
        reason: row.reason,
        status: row.status,
        updatedAt: new Date(row.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: injuriesTable.id,
      set: {
        type: sql`excluded.type`,
        reason: sql`excluded.reason`,
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

/**
 * Appends price observations, never replacing one.
 *
 * The last stored price per line is read first so an unchanged number is not
 * written again — the history stays complete without growing for no reason.
 */
export async function appendOddsSnapshots(
  fixtureId: string,
  incoming: OddsSnapshot[],
): Promise<number> {
  if (incoming.length === 0) return 0;

  const recent = await db
    .select({
      fixtureId: oddsSnapshots.fixtureId,
      provider: oddsSnapshots.provider,
      bookmaker: oddsSnapshots.bookmaker,
      market: oddsSnapshots.market,
      selection: oddsSnapshots.selection,
      decimalOdds: oddsSnapshots.decimalOdds,
      capturedAt: oddsSnapshots.capturedAt,
    })
    .from(oddsSnapshots)
    .where(eq(oddsSnapshots.fixtureId, fixtureId))
    .orderBy(desc(oddsSnapshots.capturedAt))
    .limit(500);

  const previous: OddsSnapshot[] = recent.map((row) => ({
    fixtureId: row.fixtureId,
    provider: row.provider,
    bookmaker: row.bookmaker,
    market: row.market,
    selection: row.selection,
    decimalOdds: row.decimalOdds,
    capturedAt: row.capturedAt.toISOString(),
  }));

  const fresh = selectNewSnapshots(previous, incoming);
  if (fresh.length === 0) return 0;

  await db.insert(oddsSnapshots).values(
    fresh.map((snapshot) => ({
      id: randomUUID(),
      fixtureId: snapshot.fixtureId,
      provider: snapshot.provider,
      bookmaker: snapshot.bookmaker,
      market: snapshot.market,
      selection: snapshot.selection,
      decimalOdds: snapshot.decimalOdds,
      capturedAt: new Date(snapshot.capturedAt),
    })),
  );

  return fresh.length;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** A fixture with the names the interface needs, and nothing modelled. */
export interface FixtureListItem {
  id: string;
  leagueId: string;
  leagueName: string;
  leagueCountry: string | null;
  leagueSlug: string | null;
  season: number;
  kickoff: string;
  status: string;
  elapsed: number | null;
  homeTeamId: string;
  homeTeam: string;
  homeLogo: string | null;
  awayTeamId: string;
  awayTeam: string;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  round: string | null;
  dataQuality: DataQualityStatus;
  qualityIssues: DataQualityIssue[];
}

export interface FixtureListQuery {
  /** Inclusive lower bound on kickoff. */
  from?: Date;
  /** Exclusive upper bound on kickoff. */
  to?: Date;
  /** SportAlpha league key. */
  league?: string;
  limit?: number;
}

const homeTeams = alias(sportsTeams, 'home_team');
const awayTeams = alias(sportsTeams, 'away_team');

const FIXTURE_COLUMNS = {
  id: sportsFixtures.id,
  leagueId: sportsFixtures.leagueId,
  leagueName: sportsLeagues.name,
  leagueCountry: sportsLeagues.country,
  leagueSlug: sportsLeagues.slug,
  season: sportsFixtures.season,
  kickoff: sportsFixtures.kickoff,
  status: sportsFixtures.status,
  elapsed: sportsFixtures.elapsed,
  homeTeamId: sportsFixtures.homeTeamId,
  homeTeam: homeTeams.name,
  homeLogo: homeTeams.logoUrl,
  awayTeamId: sportsFixtures.awayTeamId,
  awayTeam: awayTeams.name,
  awayLogo: awayTeams.logoUrl,
  homeScore: sportsFixtures.homeScore,
  awayScore: sportsFixtures.awayScore,
  venue: sportsFixtures.venue,
  round: sportsFixtures.round,
  dataQuality: sportsFixtures.dataQuality,
  qualityIssues: sportsFixtures.qualityIssues,
} as const;

type FixtureRow = {
  [K in keyof typeof FIXTURE_COLUMNS]: K extends 'kickoff'
    ? Date
    : FixtureListItem[K extends keyof FixtureListItem ? K : never];
};

function toListItem(row: FixtureRow): FixtureListItem {
  return { ...row, kickoff: row.kickoff.toISOString() };
}

export async function listFixtures(query: FixtureListQuery = {}): Promise<FixtureListItem[]> {
  const filters = [
    query.from ? gte(sportsFixtures.kickoff, query.from) : undefined,
    query.to ? lte(sportsFixtures.kickoff, query.to) : undefined,
    query.league ? eq(sportsLeagues.slug, query.league) : undefined,
  ].filter((clause) => clause !== undefined);

  const rows = await db
    .select(FIXTURE_COLUMNS)
    .from(sportsFixtures)
    .innerJoin(sportsLeagues, eq(sportsFixtures.leagueId, sportsLeagues.id))
    .innerJoin(homeTeams, eq(sportsFixtures.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(sportsFixtures.awayTeamId, awayTeams.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(sportsFixtures.kickoff))
    .limit(Math.min(query.limit ?? 100, 200));

  return rows.map(toListItem);
}

export interface FixtureDetail {
  fixture: FixtureListItem;
  statistics: FixtureStatistics | null;
  lineups: Lineup[];
  injuries: Injury[];
  standings: Standing[];
  /** Latest price per line, newest first. Empty when nothing has been captured. */
  odds: OddsSnapshot[];
  oddsSnapshotCount: number;
}

export async function getFixtureDetail(id: string): Promise<FixtureDetail | null> {
  const [row] = await db
    .select(FIXTURE_COLUMNS)
    .from(sportsFixtures)
    .innerJoin(sportsLeagues, eq(sportsFixtures.leagueId, sportsLeagues.id))
    .innerJoin(homeTeams, eq(sportsFixtures.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(sportsFixtures.awayTeamId, awayTeams.id))
    .where(eq(sportsFixtures.id, id))
    .limit(1);

  if (!row) return null;
  const fixture = toListItem(row);

  const [stats, lineupRows, injuryRows, standingRows, oddsRows] = await Promise.all([
    db.select().from(fixtureStatisticsTable).where(eq(fixtureStatisticsTable.fixtureId, id)).limit(1),
    db.select().from(lineupsTable).where(eq(lineupsTable.fixtureId, id)),
    db.select().from(injuriesTable).where(eq(injuriesTable.fixtureId, id)),
    db
      .select()
      .from(standingsTable)
      .where(
        and(
          eq(standingsTable.leagueId, fixture.leagueId),
          eq(standingsTable.season, fixture.season),
          inArray(standingsTable.teamId, [fixture.homeTeamId, fixture.awayTeamId]),
        ),
      ),
    db
      .select()
      .from(oddsSnapshots)
      .where(eq(oddsSnapshots.fixtureId, id))
      .orderBy(desc(oddsSnapshots.capturedAt))
      .limit(200),
  ]);

  const statsRow = stats[0];

  // One entry per price line: the newest row wins because the query is ordered.
  const latestOdds = new Map<string, OddsSnapshot>();
  for (const odds of oddsRows) {
    const key = `${odds.bookmaker}|${odds.market}|${odds.selection}`;
    if (!latestOdds.has(key)) {
      latestOdds.set(key, {
        fixtureId: odds.fixtureId,
        provider: odds.provider,
        bookmaker: odds.bookmaker,
        market: odds.market,
        selection: odds.selection,
        decimalOdds: odds.decimalOdds,
        capturedAt: odds.capturedAt.toISOString(),
      });
    }
  }

  return {
    fixture,
    statistics: statsRow
      ? {
          fixtureId: statsRow.fixtureId,
          home: {
            shotsOnGoal: statsRow.homeShotsOnGoal,
            shotsOffGoal: statsRow.homeShotsOffGoal,
            totalShots: statsRow.homeTotalShots,
            blockedShots: statsRow.homeBlockedShots,
            shotsInsideBox: statsRow.homeShotsInsideBox,
            shotsOutsideBox: statsRow.homeShotsOutsideBox,
            fouls: statsRow.homeFouls,
            corners: statsRow.homeCorners,
            offsides: statsRow.homeOffsides,
            possession: statsRow.homePossession,
            yellowCards: statsRow.homeYellowCards,
            redCards: statsRow.homeRedCards,
            goalkeeperSaves: statsRow.homeGoalkeeperSaves,
            passes: statsRow.homePasses,
            passesAccurate: statsRow.homePassesAccurate,
            passesPercentage: statsRow.homePassesPercentage,
            expectedGoals: statsRow.homeExpectedGoals,
          },
          away: {
            shotsOnGoal: statsRow.awayShotsOnGoal,
            shotsOffGoal: statsRow.awayShotsOffGoal,
            totalShots: statsRow.awayTotalShots,
            blockedShots: statsRow.awayBlockedShots,
            shotsInsideBox: statsRow.awayShotsInsideBox,
            shotsOutsideBox: statsRow.awayShotsOutsideBox,
            fouls: statsRow.awayFouls,
            corners: statsRow.awayCorners,
            offsides: statsRow.awayOffsides,
            possession: statsRow.awayPossession,
            yellowCards: statsRow.awayYellowCards,
            redCards: statsRow.awayRedCards,
            goalkeeperSaves: statsRow.awayGoalkeeperSaves,
            passes: statsRow.awayPasses,
            passesAccurate: statsRow.awayPassesAccurate,
            passesPercentage: statsRow.awayPassesPercentage,
            expectedGoals: statsRow.awayExpectedGoals,
          },
          updatedAt: statsRow.updatedAt.toISOString(),
        }
      : null,
    lineups: lineupRows.map((lineup) => ({
      fixtureId: lineup.fixtureId,
      teamId: lineup.teamId,
      formation: lineup.formation,
      coach: lineup.coach,
      startingXI: lineup.startingXi,
      substitutes: lineup.substitutes,
      confirmed: lineup.confirmed,
      updatedAt: lineup.updatedAt.toISOString(),
    })),
    injuries: injuryRows.map((injury) => ({
      id: injury.id,
      playerId: injury.playerId,
      playerName: injury.playerName,
      teamId: injury.teamId,
      fixtureId: injury.fixtureId,
      type: injury.type,
      reason: injury.reason,
      status: injury.status,
      updatedAt: injury.updatedAt.toISOString(),
    })),
    standings: standingRows.map((standing) => ({
      leagueId: standing.leagueId,
      season: standing.season,
      teamId: standing.teamId,
      rank: standing.rank,
      points: standing.points,
      played: standing.played,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      goalsFor: standing.goalsFor,
      goalsAgainst: standing.goalsAgainst,
      goalDifference: standing.goalDifference,
      form: standing.form,
      homeRecord: standing.homeRecord,
      awayRecord: standing.awayRecord,
      group: standing.group,
      updatedAt: standing.updatedAt.toISOString(),
    })),
    odds: [...latestOdds.values()],
    oddsSnapshotCount: oddsRows.length,
  };
}

export async function listStoredLeagues(): Promise<League[]> {
  const rows = await db.select().from(sportsLeagues).orderBy(asc(sportsLeagues.name));
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    providerId: row.providerId,
    name: row.name,
    country: row.country,
    countryCode: row.countryCode,
    logoUrl: row.logoUrl,
    type: row.type,
    active: row.active,
    slug: row.slug,
  }));
}

export interface StandingRow extends Standing {
  teamName: string;
  teamLogo: string | null;
}

export async function listStandings(
  leagueSlugOrId: string,
  season?: number,
): Promise<StandingRow[]> {
  const [league] = await db
    .select({ id: sportsLeagues.id })
    .from(sportsLeagues)
    .where(
      sql`${sportsLeagues.slug} = ${leagueSlugOrId} or ${sportsLeagues.id} = ${leagueSlugOrId}`,
    )
    .limit(1);

  if (!league) return [];

  const filters = [eq(standingsTable.leagueId, league.id)];
  if (season !== undefined) filters.push(eq(standingsTable.season, season));

  const rows = await db
    .select({
      standing: standingsTable,
      teamName: sportsTeams.name,
      teamLogo: sportsTeams.logoUrl,
    })
    .from(standingsTable)
    .innerJoin(sportsTeams, eq(standingsTable.teamId, sportsTeams.id))
    .where(and(...filters))
    .orderBy(asc(standingsTable.season), asc(standingsTable.rank));

  return rows.map(({ standing, teamName, teamLogo }) => ({
    leagueId: standing.leagueId,
    season: standing.season,
    teamId: standing.teamId,
    rank: standing.rank,
    points: standing.points,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goalsFor,
    goalsAgainst: standing.goalsAgainst,
    goalDifference: standing.goalDifference,
    form: standing.form,
    homeRecord: standing.homeRecord,
    awayRecord: standing.awayRecord,
    group: standing.group,
    updatedAt: standing.updatedAt.toISOString(),
    teamName,
    teamLogo,
  }));
}
