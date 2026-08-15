import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type {
  DataQualityIssue,
  FixtureStatus,
  LineupPlayer,
  StandingRecord,
} from '../src/lib/sports/types.ts';

export const planTier = pgEnum('plan_tier', ['free', 'pro', 'advanced', 'quant']);
export const subscriptionState = pgEnum('subscription_state', [
  'inactive',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
]);

export const profiles = pgTable('profiles', {
  id: text().primaryKey(),
  email: text().notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  plan: planTier().notNull().default('free'),
  subscriptionStatus: subscriptionState('subscription_status').notNull().default('inactive'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripePriceId: text('stripe_price_id'),
  plan: planTier().notNull(),
  status: subscriptionState().notNull(),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usageLogs = pgTable(
  'usage_logs',
  {
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    feature: text().notNull(),
    usageDate: date('usage_date').notNull(),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.feature, table.usageDate] })],
);

export const simulationRuns = pgTable('simulation_runs', {
  id: text().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(),
  simulations: integer().notNull(),
  inputParameters: jsonb('input_parameters').$type<Record<string, unknown>>().notNull(),
  results: jsonb().$type<Record<string, unknown>>().notNull(),
  executionTimeMs: integer('execution_time_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sports data
//
// Every table below is fed by a provider adapter and carries the provider it
// came from alongside that provider's own id. The pair is unique, which is what
// makes a re-sync an upsert rather than a duplicate, and what lets a second
// provider's records live beside the first without colliding.
//
// Primary keys are the internal ids the adapters mint (`af-1035037`): stable
// across syncs, readable in a URL, and never a database sequence, so a row can
// be referenced before it is written.
// ---------------------------------------------------------------------------

export const fixtureStatus = pgEnum('fixture_status', [
  'scheduled',
  'live',
  'finished',
  'postponed',
  'canceled',
  'unknown',
]);

/** How much the Quant Engine should trust a row. See `src/lib/sports/quality.ts`. */
export const dataQualityStatus = pgEnum('data_quality_status', [
  'GOOD',
  'PARTIAL',
  'STALE',
  'INVALID',
]);

export const syncRunStatus = pgEnum('sync_run_status', [
  'running',
  'completed',
  'partial',
  'failed',
]);

export const sportsLeagues = pgTable(
  'sports_leagues',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    providerId: text('provider_id').notNull(),
    name: text().notNull(),
    country: text(),
    countryCode: text('country_code'),
    logoUrl: text('logo_url'),
    type: text(),
    /** SportAlpha's own key from `SUPPORTED_LEAGUES`, when the league is one. */
    slug: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('sports_leagues_provider_key').on(table.provider, table.providerId)],
);

export const sportsSeasons = pgTable(
  'sports_seasons',
  {
    id: text().primaryKey(),
    leagueId: text('league_id')
      .notNull()
      .references(() => sportsLeagues.id, { onDelete: 'cascade' }),
    year: integer().notNull(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    current: boolean().notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('sports_seasons_league_year_key').on(table.leagueId, table.year)],
);

export const sportsTeams = pgTable(
  'sports_teams',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    providerId: text('provider_id').notNull(),
    name: text().notNull(),
    code: text(),
    country: text(),
    logoUrl: text('logo_url'),
    founded: integer(),
    venueName: text('venue_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('sports_teams_provider_key').on(table.provider, table.providerId)],
);

export const sportsFixtures = pgTable(
  'sports_fixtures',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    providerId: text('provider_id').notNull(),
    leagueId: text('league_id')
      .notNull()
      .references(() => sportsLeagues.id, { onDelete: 'cascade' }),
    season: integer().notNull(),
    homeTeamId: text('home_team_id')
      .notNull()
      .references(() => sportsTeams.id, { onDelete: 'cascade' }),
    awayTeamId: text('away_team_id')
      .notNull()
      .references(() => sportsTeams.id, { onDelete: 'cascade' }),
    kickoff: timestamp({ withTimezone: true }).notNull(),
    timezone: text(),
    status: fixtureStatus().notNull().default('scheduled'),
    elapsed: integer(),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    venue: text(),
    referee: text(),
    round: text(),
    /** Grade and reasons, so consumers can filter incomplete rows out. */
    dataQuality: dataQualityStatus('data_quality').notNull().default('GOOD'),
    qualityIssues: jsonb('quality_issues').$type<DataQualityIssue[]>().notNull().default([]),
    /** Provider status code, kept for debugging without storing raw payloads. */
    providerStatus: text('provider_status').$type<FixtureStatus | string>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('sports_fixtures_provider_key').on(table.provider, table.providerId),
    index('sports_fixtures_kickoff_idx').on(table.kickoff),
    index('sports_fixtures_league_season_idx').on(table.leagueId, table.season),
  ],
);

/**
 * One row per fixture, with each side's measurements side by side.
 *
 * Every column is nullable on purpose: the feed reports a subset that varies by
 * competition and plan, and a missing measurement must stay missing rather than
 * defaulting to zero.
 */
export const fixtureStatistics = pgTable('fixture_statistics', {
  fixtureId: text('fixture_id')
    .primaryKey()
    .references(() => sportsFixtures.id, { onDelete: 'cascade' }),

  homeShotsOnGoal: integer('home_shots_on_goal'),
  homeShotsOffGoal: integer('home_shots_off_goal'),
  homeTotalShots: integer('home_total_shots'),
  homeBlockedShots: integer('home_blocked_shots'),
  homeShotsInsideBox: integer('home_shots_inside_box'),
  homeShotsOutsideBox: integer('home_shots_outside_box'),
  homeFouls: integer('home_fouls'),
  homeCorners: integer('home_corners'),
  homeOffsides: integer('home_offsides'),
  homePossession: real('home_possession'),
  homeYellowCards: integer('home_yellow_cards'),
  homeRedCards: integer('home_red_cards'),
  homeGoalkeeperSaves: integer('home_goalkeeper_saves'),
  homePasses: integer('home_passes'),
  homePassesAccurate: integer('home_passes_accurate'),
  homePassesPercentage: real('home_passes_percentage'),
  homeExpectedGoals: real('home_expected_goals'),

  awayShotsOnGoal: integer('away_shots_on_goal'),
  awayShotsOffGoal: integer('away_shots_off_goal'),
  awayTotalShots: integer('away_total_shots'),
  awayBlockedShots: integer('away_blocked_shots'),
  awayShotsInsideBox: integer('away_shots_inside_box'),
  awayShotsOutsideBox: integer('away_shots_outside_box'),
  awayFouls: integer('away_fouls'),
  awayCorners: integer('away_corners'),
  awayOffsides: integer('away_offsides'),
  awayPossession: real('away_possession'),
  awayYellowCards: integer('away_yellow_cards'),
  awayRedCards: integer('away_red_cards'),
  awayGoalkeeperSaves: integer('away_goalkeeper_saves'),
  awayPasses: integer('away_passes'),
  awayPassesAccurate: integer('away_passes_accurate'),
  awayPassesPercentage: real('away_passes_percentage'),
  awayExpectedGoals: real('away_expected_goals'),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const standings = pgTable(
  'standings',
  {
    id: text().primaryKey(),
    leagueId: text('league_id')
      .notNull()
      .references(() => sportsLeagues.id, { onDelete: 'cascade' }),
    season: integer().notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => sportsTeams.id, { onDelete: 'cascade' }),
    rank: integer().notNull(),
    points: integer().notNull(),
    played: integer().notNull(),
    wins: integer().notNull(),
    draws: integer().notNull(),
    losses: integer().notNull(),
    goalsFor: integer('goals_for').notNull(),
    goalsAgainst: integer('goals_against').notNull(),
    goalDifference: integer('goal_difference').notNull(),
    form: text(),
    homeRecord: jsonb('home_record').$type<StandingRecord | null>(),
    awayRecord: jsonb('away_record').$type<StandingRecord | null>(),
    group: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('standings_league_season_team_key').on(table.leagueId, table.season, table.teamId),
  ],
);

export const lineups = pgTable(
  'lineups',
  {
    id: text().primaryKey(),
    fixtureId: text('fixture_id')
      .notNull()
      .references(() => sportsFixtures.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => sportsTeams.id, { onDelete: 'cascade' }),
    formation: text(),
    coach: text(),
    startingXi: jsonb('starting_xi').$type<LineupPlayer[]>().notNull().default([]),
    substitutes: jsonb().$type<LineupPlayer[]>().notNull().default([]),
    /** False while the XI is a projection rather than the announced sheet. */
    confirmed: boolean().notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('lineups_fixture_team_key').on(table.fixtureId, table.teamId)],
);

export const injuries = pgTable(
  'injuries',
  {
    id: text().primaryKey(),
    playerId: text('player_id'),
    playerName: text('player_name').notNull(),
    teamId: text('team_id')
      .notNull()
      .references(() => sportsTeams.id, { onDelete: 'cascade' }),
    fixtureId: text('fixture_id').references(() => sportsFixtures.id, { onDelete: 'cascade' }),
    type: text(),
    reason: text(),
    status: text(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('injuries_fixture_idx').on(table.fixtureId)],
);

/**
 * Append-only price history.
 *
 * There is deliberately **no** unique constraint on
 * (fixture, bookmaker, market, selection): the whole point is that the same
 * selection appears many times over, each row recording what the price was at
 * `captured_at`. Line movement, closing-line comparison and backtesting all
 * depend on that history existing, so nothing may overwrite it.
 */
export const oddsSnapshots = pgTable(
  'odds_snapshots',
  {
    id: text().primaryKey(),
    fixtureId: text('fixture_id')
      .notNull()
      .references(() => sportsFixtures.id, { onDelete: 'cascade' }),
    provider: text().notNull(),
    bookmaker: text().notNull(),
    market: text().notNull(),
    selection: text().notNull(),
    decimalOdds: real('decimal_odds').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('odds_snapshots_fixture_captured_idx').on(table.fixtureId, table.capturedAt),
    index('odds_snapshots_line_idx').on(
      table.fixtureId,
      table.bookmaker,
      table.market,
      table.selection,
    ),
  ],
);

/**
 * One row per import attempt.
 *
 * This is how an operator answers "is the data feed working?" without reading
 * logs. Raw provider payloads are never stored — only counts and a truncated
 * error summary — so the table stays small no matter how often sync runs.
 */
export const sportsSyncRuns = pgTable(
  'sports_sync_runs',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    syncType: text('sync_type').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: syncRunStatus().notNull().default('running'),
    recordsReceived: integer('records_received').notNull().default(0),
    recordsInserted: integer('records_inserted').notNull().default(0),
    recordsUpdated: integer('records_updated').notNull().default(0),
    recordsFailed: integer('records_failed').notNull().default(0),
    apiRequests: integer('api_requests').notNull().default(0),
    errorSummary: text('error_summary'),
    /** What was asked for: date, league keys. Small and queryable, unlike a payload. */
    params: jsonb().$type<Record<string, unknown>>(),
    triggeredBy: text('triggered_by'),
  },
  (table) => [index('sports_sync_runs_started_idx').on(table.startedAt)],
);

/**
 * Request counter, one row per provider endpoint per day.
 *
 * Feeds bill by request and cut you off at the plan ceiling, so knowing what
 * has already been spent today is what makes the TTL checks in
 * `src/lib/sports/config.ts` enforceable rather than advisory.
 */
export const sportsApiUsage = pgTable(
  'sports_api_usage',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    endpoint: text().notNull(),
    usageDate: date('usage_date').notNull(),
    requests: integer().notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('sports_api_usage_key').on(table.provider, table.endpoint, table.usageDate),
  ],
);

/**
 * Latest quota reading per provider.
 *
 * `sports_api_usage` counts what we spent; this records what the provider says
 * is left, which is not the same number — other processes, other environments
 * and the provider's own accounting all move it. One row per provider, always
 * overwritten: a reading is only useful while it is current.
 *
 * Every counter is nullable because "the provider did not say" is a real state
 * and must stay distinguishable from "zero left".
 */
export const sportsProviderQuota = pgTable('sports_provider_quota', {
  provider: text().primaryKey(),
  dailyLimit: integer('daily_limit'),
  dailyRemaining: integer('daily_remaining'),
  burstLimit: integer('burst_limit'),
  burstRemaining: integer('burst_remaining'),
  /** HTTP status of the last response — 200 even when the payload was an error. */
  lastStatus: integer('last_status'),
  lastEndpoint: text('last_endpoint'),
  /** `SUCCESS`, or the classified error code. */
  lastOutcome: text('last_outcome'),
  lastMessage: text('last_message'),
  lastResultCount: integer('last_result_count'),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
});

