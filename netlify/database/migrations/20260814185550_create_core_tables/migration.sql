CREATE TYPE "plan_tier" AS ENUM('free', 'pro', 'advanced', 'quant');--> statement-breakpoint
CREATE TYPE "subscription_state" AS ENUM('inactive', 'trialing', 'active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"plan" "plan_tier" DEFAULT 'free'::"plan_tier" NOT NULL,
	"subscription_status" "subscription_state" DEFAULT 'inactive'::"subscription_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_runs" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"match_id" text NOT NULL,
	"simulations" integer NOT NULL,
	"input_parameters" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"execution_time_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_price_id" text,
	"plan" "plan_tier" NOT NULL,
	"status" "subscription_state" NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"user_id" text,
	"feature" text,
	"usage_date" date,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_logs_pkey" PRIMARY KEY("user_id","feature","usage_date")
);
--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;