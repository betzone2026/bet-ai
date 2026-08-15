CREATE TABLE "sports_provider_quota" (
	"provider" text PRIMARY KEY,
	"daily_limit" integer,
	"daily_remaining" integer,
	"burst_limit" integer,
	"burst_remaining" integer,
	"last_status" integer,
	"last_endpoint" text,
	"last_outcome" text,
	"last_message" text,
	"last_result_count" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
