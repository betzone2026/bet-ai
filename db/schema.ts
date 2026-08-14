import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

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

