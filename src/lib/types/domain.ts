/**
 * View models: the shapes the interface actually renders. They are
 * assembled from the database rows (or, until the quantitative backend
 * is wired up in step 2, from the clearly-labelled demo dataset).
 */
import type { MatchState } from './database';

export interface Outcome1X2 {
  home: number;
  draw: number;
  away: number;
}

export interface GoalsMarket {
  over15: number;
  over25: number;
  over35: number;
  btts: number;
}

export interface ScoreLine {
  home: number;
  away: number;
  probability: number;
}

export interface TeamStats {
  form: number;        // 0–1 rolling form index
  xgFor: number;
  xgAgainst: number;
  elo: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MatchView {
  id: string;
  league: string;
  country: string;
  kickoff: string;         // ISO 8601
  status: MatchState;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  probabilities: Outcome1X2;
  goals: GoalsMarket;
  /** 0–1. How much data the estimate rests on, not how likely it is to win. */
  confidence: number;
  /** 0–1. Dispersion of simulated outcomes; higher means less predictable. */
  risk: number;
  modelVersion: string;
  topScores: ScoreLine[];
  home: TeamStats;
  away: TeamStats;
  /** True while the row comes from the demo dataset rather than a live feed. */
  demo: boolean;
}

export interface SimulationResult {
  simulations: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  btts: number;
  scoreDistribution: Record<string, number>;
  confidenceInterval: { home: [number, number]; draw: [number, number]; away: [number, number] };
  executionTimeMs: number;
  engine: 'netlify-server';
}

/** Context handed to the AI Analyst. The model explains it; it never invents it. */
export interface QuantitativeContext {
  matchId: string;
  fixture: string;
  kickoff: string;
  league: string;
  modelVersion: string;
  probabilities: Outcome1X2;
  goals: GoalsMarket;
  confidence: number;
  risk: number;
  topScores: ScoreLine[];
  statistics: { home: TeamStats; away: TeamStats };
  monteCarlo: SimulationResult | null;
  generatedAt: string;
}
