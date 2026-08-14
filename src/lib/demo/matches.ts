/**
 * Demo dataset. Every record carries `demo: true` and the interface
 * labels it as such. It exists so the product is navigable before the
 * sports-data feed and quantitative engine land in step 2; it is not a
 * forecast of anything and must never be presented as one.
 *
 * Numbers are internally consistent — 1X2 sums to 1, score lines are
 * ordered — so the components can be built against realistic shapes.
 */
import type { MatchView } from '@/lib/types/domain';

function isoAt(hoursFromNow: number): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

export const DEMO_MATCHES: MatchView[] = [
  {
    id: 'dm-001',
    league: 'Premier League', country: 'England',
    kickoff: isoAt(4), status: 'scheduled',
    homeTeam: 'Arsenal', awayTeam: 'Brighton',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.561, draw: 0.244, away: 0.195 },
    goals: { over15: 0.812, over25: 0.601, over35: 0.352, btts: 0.548 },
    confidence: 0.78, risk: 0.31, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 2, away: 1, probability: 0.113 },
      { home: 1, away: 0, probability: 0.101 },
      { home: 2, away: 0, probability: 0.098 },
      { home: 1, away: 1, probability: 0.094 },
      { home: 3, away: 1, probability: 0.062 },
    ],
    home: { form: 0.74, xgFor: 1.92, xgAgainst: 0.98, elo: 1884, goalsFor: 34, goalsAgainst: 17 },
    away: { form: 0.52, xgFor: 1.41, xgAgainst: 1.36, elo: 1731, goalsFor: 27, goalsAgainst: 26 },
    demo: true,
  },
  {
    id: 'dm-002',
    league: 'Serie A', country: 'Italy',
    kickoff: isoAt(6), status: 'scheduled',
    homeTeam: 'Napoli', awayTeam: 'Inter',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.361, draw: 0.291, away: 0.348 },
    goals: { over15: 0.744, over25: 0.498, over35: 0.256, btts: 0.531 },
    confidence: 0.64, risk: 0.58, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 1, away: 1, probability: 0.129 },
      { home: 1, away: 0, probability: 0.096 },
      { home: 0, away: 1, probability: 0.092 },
      { home: 2, away: 1, probability: 0.081 },
      { home: 1, away: 2, probability: 0.078 },
    ],
    home: { form: 0.61, xgFor: 1.58, xgAgainst: 1.09, elo: 1812, goalsFor: 29, goalsAgainst: 19 },
    away: { form: 0.66, xgFor: 1.64, xgAgainst: 1.02, elo: 1826, goalsFor: 31, goalsAgainst: 18 },
    demo: true,
  },
  {
    id: 'dm-003',
    league: 'La Liga', country: 'Spain',
    kickoff: isoAt(8), status: 'scheduled',
    homeTeam: 'Girona', awayTeam: 'Real Madrid',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.204, draw: 0.243, away: 0.553 },
    goals: { over15: 0.836, over25: 0.634, over35: 0.389, btts: 0.592 },
    confidence: 0.71, risk: 0.42, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 1, away: 2, probability: 0.112 },
      { home: 0, away: 2, probability: 0.104 },
      { home: 1, away: 3, probability: 0.079 },
      { home: 0, away: 1, probability: 0.077 },
      { home: 1, away: 1, probability: 0.074 },
    ],
    home: { form: 0.48, xgFor: 1.36, xgAgainst: 1.61, elo: 1698, goalsFor: 25, goalsAgainst: 30 },
    away: { form: 0.79, xgFor: 2.14, xgAgainst: 0.94, elo: 1921, goalsFor: 41, goalsAgainst: 16 },
    demo: true,
  },
  {
    id: 'dm-004',
    league: 'Bundesliga', country: 'Germany',
    kickoff: isoAt(9), status: 'scheduled',
    homeTeam: 'Bayer Leverkusen', awayTeam: 'Stuttgart',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.487, draw: 0.256, away: 0.257 },
    goals: { over15: 0.861, over25: 0.688, over35: 0.441, btts: 0.634 },
    confidence: 0.69, risk: 0.47, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 2, away: 1, probability: 0.118 },
      { home: 2, away: 2, probability: 0.087 },
      { home: 3, away: 1, probability: 0.081 },
      { home: 1, away: 1, probability: 0.079 },
      { home: 3, away: 2, probability: 0.061 },
    ],
    home: { form: 0.70, xgFor: 2.08, xgAgainst: 1.21, elo: 1857, goalsFor: 38, goalsAgainst: 22 },
    away: { form: 0.57, xgFor: 1.71, xgAgainst: 1.44, elo: 1764, goalsFor: 32, goalsAgainst: 27 },
    demo: true,
  },
  {
    id: 'dm-005',
    league: 'Premier League', country: 'England',
    kickoff: isoAt(11), status: 'scheduled',
    homeTeam: 'Everton', awayTeam: 'Crystal Palace',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.383, draw: 0.302, away: 0.315 },
    goals: { over15: 0.681, over25: 0.421, over35: 0.187, btts: 0.463 },
    confidence: 0.55, risk: 0.63, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 1, away: 1, probability: 0.134 },
      { home: 1, away: 0, probability: 0.121 },
      { home: 0, away: 1, probability: 0.108 },
      { home: 0, away: 0, probability: 0.091 },
      { home: 2, away: 1, probability: 0.077 },
    ],
    home: { form: 0.44, xgFor: 1.18, xgAgainst: 1.29, elo: 1652, goalsFor: 21, goalsAgainst: 24 },
    away: { form: 0.46, xgFor: 1.22, xgAgainst: 1.24, elo: 1661, goalsFor: 22, goalsAgainst: 23 },
    demo: true,
  },
  {
    id: 'dm-006',
    league: 'Serie A', country: 'Italy',
    kickoff: isoAt(13), status: 'scheduled',
    homeTeam: 'Atalanta', awayTeam: 'Lazio',
    homeScore: null, awayScore: null,
    probabilities: { home: 0.518, draw: 0.242, away: 0.240 },
    goals: { over15: 0.798, over25: 0.577, over35: 0.331, btts: 0.561 },
    confidence: 0.73, risk: 0.38, modelVersion: 'demo-0.1.0',
    topScores: [
      { home: 2, away: 1, probability: 0.116 },
      { home: 2, away: 0, probability: 0.102 },
      { home: 1, away: 0, probability: 0.094 },
      { home: 1, away: 1, probability: 0.089 },
      { home: 3, away: 1, probability: 0.058 },
    ],
    home: { form: 0.72, xgFor: 1.97, xgAgainst: 1.06, elo: 1843, goalsFor: 36, goalsAgainst: 20 },
    away: { form: 0.54, xgFor: 1.44, xgAgainst: 1.31, elo: 1742, goalsFor: 28, goalsAgainst: 25 },
    demo: true,
  },
];

export function getDemoMatch(id: string): MatchView | null {
  return DEMO_MATCHES.find((m) => m.id === id) ?? null;
}
