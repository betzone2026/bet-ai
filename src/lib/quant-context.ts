/**
 * getQuantitativeContext(matchId)
 *
 * The AI Analyst is an explanation layer, not a source of numbers. This
 * function assembles every figure the model is allowed to talk about;
 * the prompt then instructs it to explain that payload and nothing else.
 * If a figure is absent here, the model has no business stating it.
 */
import { getDemoMatch } from '@/lib/demo/matches';
import type { QuantitativeContext, SimulationResult } from '@/lib/types/domain';

export async function getQuantitativeContext(
  matchId: string,
  monteCarlo: SimulationResult | null = null,
): Promise<QuantitativeContext | null> {
  // Replace this lookup with the live sports-data feed when it is connected.
  const match = getDemoMatch(matchId);
  if (!match) return null;

  return {
    matchId: match.id,
    fixture: `${match.homeTeam} vs ${match.awayTeam}`,
    kickoff: match.kickoff,
    league: match.league,
    modelVersion: match.modelVersion,
    probabilities: match.probabilities,
    goals: match.goals,
    confidence: match.confidence,
    risk: match.risk,
    topScores: match.topScores,
    statistics: { home: match.home, away: match.away },
    monteCarlo,
    generatedAt: new Date().toISOString(),
  };
}

/** System prompt: the context, plus the rules the model must follow. */
export function buildAnalystPrompt(context: QuantitativeContext): string {
  return [
    'You are the SportAlpha AI analyst. You explain quantitative output to users.',
    '',
    'Rules, in order of precedence:',
    '1. Every number you state must appear in the CONTEXT block below.',
    '2. Never invent statistics, odds, injuries, line-ups or results.',
    '3. Never promise an outcome and never advise how much anyone should stake.',
    '4. Probabilities describe uncertainty. Say so plainly when confidence is low.',
    '5. If the context does not contain what the user asked for, say what is missing.',
    '',
    'CONTEXT (JSON, probabilities are fractions of 1):',
    JSON.stringify(context, null, 2),
  ].join('\n');
}
