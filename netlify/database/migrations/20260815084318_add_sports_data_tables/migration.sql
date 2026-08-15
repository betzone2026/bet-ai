CREATE TYPE "data_quality_status" AS ENUM('GOOD', 'PARTIAL', 'STALE', 'INVALID');--> statement-breakpoint
CREATE TYPE "fixture_status" AS ENUM('scheduled', 'live', 'finished', 'postponed', 'canceled', 'unknown');--> statement-breakpoint
CREATE TYPE "sync_run_status" AS ENUM('running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "fixture_statistics" (
	"fixture_id" text PRIMARY KEY,
	"home_shots_on_goal" integer,
	"home_shots_off_goal" integer,
	"home_total_shots" integer,
	"home_blocked_shots" integer,
	"home_shots_inside_box" integer,
	"home_shots_outside_box" integer,
	"home_fouls" integer,
	"home_corners" integer,
	"home_offsides" integer,
	"home_possession" real,
	"home_yellow_cards" integer,
	"home_red_cards" integer,
	"home_goalkeeper_saves" integer,
	"home_passes" integer,
	"home_passes_accurate" integer,
	"home_passes_percentage" real,
	"home_expected_goals" real,
	"away_shots_on_goal" integer,
	"away_shots_off_goal" integer,
	"away_total_shots" integer,
	"away_blocked_shots" integer,
	"away_shots_inside_box" integer,
	"away_shots_outside_box" integer,
	"away_fouls" integer,
	"away_corners" integer,
	"away_offsides" integer,
	"away_possession" real,
	"away_yellow_cards" integer,
	"away_red_cards" integer,
	"away_goalkeeper_saves" integer,
	"away_passes" integer,
	"away_passes_accurate" integer,
	"away_passes_percentage" real,
	"away_expected_goals" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" text PRIMARY KEY,
	"player_id" text,
	"player_name" text NOT NULL,
	"team_id" text NOT NULL,
	"fixture_id" text,
	"type" text,
	"reason" text,
	"status" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineups" (
	"id" text PRIMARY KEY,
	"fixture_id" text NOT NULL,
	"team_id" text NOT NULL,
	"formation" text,
	"coach" text,
	"starting_xi" jsonb DEFAULT '[]' NOT NULL,
	"substitutes" jsonb DEFAULT '[]' NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lineups_fixture_team_key" UNIQUE("fixture_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "odds_snapshots" (
	"id" text PRIMARY KEY,
	"fixture_id" text NOT NULL,
	"provider" text NOT NULL,
	"bookmaker" text NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"decimal_odds" real NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports_api_usage" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"usage_date" date NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_api_usage_key" UNIQUE("provider","endpoint","usage_date")
);
--> statement-breakpoint
CREATE TABLE "sports_fixtures" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"league_id" text NOT NULL,
	"season" integer NOT NULL,
	"home_team_id" text NOT NULL,
	"away_team_id" text NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"timezone" text,
	"status" "fixture_status" DEFAULT 'scheduled'::"fixture_status" NOT NULL,
	"elapsed" integer,
	"home_score" integer,
	"away_score" integer,
	"venue" text,
	"referee" text,
	"round" text,
	"data_quality" "data_quality_status" DEFAULT 'GOOD'::"data_quality_status" NOT NULL,
	"quality_issues" jsonb DEFAULT '[]' NOT NULL,
	"provider_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_fixtures_provider_key" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "sports_leagues" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"country_code" text,
	"logo_url" text,
	"type" text,
	"slug" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_leagues_provider_key" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "sports_seasons" (
	"id" text PRIMARY KEY,
	"league_id" text NOT NULL,
	"year" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"current" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_seasons_league_year_key" UNIQUE("league_id","year")
);
--> statement-breakpoint
CREATE TABLE "sports_sync_runs" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"sync_type" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "sync_run_status" DEFAULT 'running'::"sync_run_status" NOT NULL,
	"records_received" integer DEFAULT 0 NOT NULL,
	"records_inserted" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"api_requests" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"params" jsonb,
	"triggered_by" text
);
--> statement-breakpoint
CREATE TABLE "sports_teams" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"country" text,
	"logo_url" text,
	"founded" integer,
	"venue_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_teams_provider_key" UNIQUE("provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"id" text PRIMARY KEY,
	"league_id" text NOT NULL,
	"season" integer NOT NULL,
	"team_id" text NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"played" integer NOT NULL,
	"wins" integer NOT NULL,
	"draws" integer NOT NULL,
	"losses" integer NOT NULL,
	"goals_for" integer NOT NULL,
	"goals_against" integer NOT NULL,
	"goal_difference" integer NOT NULL,
	"form" text,
	"home_record" jsonb,
	"away_record" jsonb,
	"group" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standings_league_season_team_key" UNIQUE("league_id","season","team_id")
);
--> statement-breakpoint
CREATE INDEX "injuries_fixture_idx" ON "injuries" ("fixture_id");--> statement-breakpoint
CREATE INDEX "odds_snapshots_fixture_captured_idx" ON "odds_snapshots" ("fixture_id","captured_at");--> statement-breakpoint
CREATE INDEX "odds_snapshots_line_idx" ON "odds_snapshots" ("fixture_id","bookmaker","market","selection");--> statement-breakpoint
CREATE INDEX "sports_fixtures_kickoff_idx" ON "sports_fixtures" ("kickoff");--> statement-breakpoint
CREATE INDEX "sports_fixtures_league_season_idx" ON "sports_fixtures" ("league_id","season");--> statement-breakpoint
CREATE INDEX "sports_sync_runs_started_idx" ON "sports_sync_runs" ("started_at");--> statement-breakpoint
ALTER TABLE "fixture_statistics" ADD CONSTRAINT "fixture_statistics_fixture_id_sports_fixtures_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "sports_fixtures"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_team_id_sports_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sports_teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_fixture_id_sports_fixtures_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "sports_fixtures"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_fixture_id_sports_fixtures_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "sports_fixtures"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_team_id_sports_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sports_teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_fixture_id_sports_fixtures_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "sports_fixtures"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sports_fixtures" ADD CONSTRAINT "sports_fixtures_league_id_sports_leagues_id_fkey" FOREIGN KEY ("league_id") REFERENCES "sports_leagues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sports_fixtures" ADD CONSTRAINT "sports_fixtures_home_team_id_sports_teams_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "sports_teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sports_fixtures" ADD CONSTRAINT "sports_fixtures_away_team_id_sports_teams_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "sports_teams"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sports_seasons" ADD CONSTRAINT "sports_seasons_league_id_sports_leagues_id_fkey" FOREIGN KEY ("league_id") REFERENCES "sports_leagues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_league_id_sports_leagues_id_fkey" FOREIGN KEY ("league_id") REFERENCES "sports_leagues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_sports_teams_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sports_teams"("id") ON DELETE CASCADE;