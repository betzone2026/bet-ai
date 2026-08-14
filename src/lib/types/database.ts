/**
 * Public application data shapes used by the interface.
 */
import type { PlanId } from '@/lib/config/plans';

export type SubscriptionState =
  | 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

export type MatchState =
  | 'scheduled' | 'live' | 'finished' | 'postponed' | 'canceled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: PlanId;
  subscription_status: SubscriptionState;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: PlanId;
  status: SubscriptionState;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
}

export interface Sport { id: string; name: string; slug: string; active: boolean }

export interface League {
  id: string; sport_id: string; name: string;
  country: string | null; slug: string; active: boolean;
}

export interface Team {
  id: string; league_id: string; name: string;
  short_name: string | null; logo_url: string | null; external_id: string | null;
}

export interface Match {
  id: string;
  external_id: string | null;
  league_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  status: MatchState;
  home_score: number | null;
  away_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatchStatistics {
  id: string; match_id: string;
  home_xg: number | null; away_xg: number | null;
  home_form: number | null; away_form: number | null;
  home_elo: number | null; away_elo: number | null;
  raw_data: Record<string, unknown>;
  updated_at: string;
}

export interface ModelPrediction {
  id: string;
  match_id: string;
  model_version: string;
  home_probability: number;
  draw_probability: number;
  away_probability: number;
  over_15_probability: number | null;
  over_25_probability: number | null;
  over_35_probability: number | null;
  btts_probability: number | null;
  confidence_score: number | null;
  risk_score: number | null;
  created_at: string;
}

export interface MonteCarloRun {
  id: string;
  user_id: string;
  match_id: string;
  simulations: number;
  input_parameters: Record<string, unknown>;
  results: Record<string, unknown>;
  execution_time_ms: number | null;
  created_at: string;
}

export interface UsageLog {
  id: string; user_id: string; feature: string;
  usage_count: number; usage_date: string; created_at: string;
}
