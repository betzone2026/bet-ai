CREATE TABLE "sports_league_coverage" (
	"provider" text,
	"league_key" text,
	"provider_league_id" text,
	"name" text,
	"country" text,
	"current_season" integer,
	"latest_season" integer,
	"seasons" jsonb DEFAULT '[]' NOT NULL,
	"fixtures_available" boolean DEFAULT false NOT NULL,
	"error" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_league_coverage_pkey" PRIMARY KEY("provider","league_key")
);
--> statement-breakpoint
ALTER TABLE "sports_sync_runs" ADD COLUMN "provider_returned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sports_sync_runs" ADD COLUMN "records_matched" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sports_sync_runs" ADD COLUMN "records_unchanged" integer DEFAULT 0 NOT NULL;