import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { getQuantitativeContext, buildAnalystPrompt } from '@/lib/quant-context';
import { getPlan } from '@/lib/config/plans';
import type { QuantitativeContext } from '@/lib/types/domain';
import { pct, riskLevel } from '@/lib/utils';
import { releaseUsage, reserveUsage } from '@/lib/usage';

export const runtime = 'nodejs';

const FEATURE = 'ai_query';
const MAX_QUESTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Log in to use the analyst.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { matchId?: string; question?: string }
    | null;

  const matchId = body?.matchId?.trim();
  const question = body?.question?.trim();

  if (!matchId || !question) {
    return NextResponse.json({ error: 'Pick a match and ask a question.' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Keep questions under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // ---- plan limit ---------------------------------------------------
  const limit = getPlan(profile.plan).limits.aiQueriesDaily;

  // ---- context ------------------------------------------------------
  const context = await getQuantitativeContext(matchId);
  if (!context) {
    return NextResponse.json({ error: 'That match is not in the catalogue.' }, { status: 404 });
  }

  const reserved = await reserveUsage(profile.id, FEATURE, limit);
  if (!reserved) {
    return NextResponse.json(
      { error: `You have used all ${limit} analyst questions for today. The counter resets at midnight UTC.` },
      { status: 429 },
    );
  }

  // ---- answer -------------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No model configured: answer deterministically from the same context
    // the model would have received, so the flow is testable end to end.
    return NextResponse.json({ answer: explainFromContext(context, question) });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system: buildAnalystPrompt(context),
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) throw new Error(`Model returned ${response.status}`);

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const answer = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();

    return NextResponse.json({ answer: answer || explainFromContext(context, question) });
  } catch {
    await releaseUsage(profile.id, FEATURE);
    return NextResponse.json(
      { error: 'The analyst could not be reached. Try again in a moment.' },
      { status: 502 },
    );
  }
}

/**
 * Deterministic fallback. It restates the context in prose and adds no
 * information of its own — which is exactly the constraint the model
 * operates under, so the two paths never disagree on the numbers.
 */
function explainFromContext(context: QuantitativeContext, question: string): string {
  const { probabilities: p, goals, statistics } = context;
  const ordered = [
    { label: 'a home win', value: p.home },
    { label: 'a draw', value: p.draw },
    { label: 'an away win', value: p.away },
  ].sort((a, b) => b.value - a.value);

  const top = ordered[0]!;
  const spread = top.value - ordered[2]!.value;

  return [
    `${context.fixture} (${context.league}), model ${context.modelVersion}.`,
    '',
    `The current estimate favours ${top.label} at ${pct(top.value)}, against ${pct(ordered[1]!.value)} for ${ordered[1]!.label} and ${pct(ordered[2]!.value)} for ${ordered[2]!.label}. The gap between the most and least likely result is ${pct(spread)}, so ${spread > 0.25 ? 'the fixture is reasonably one-sided by this model' : 'the three outcomes are close together and the fixture is genuinely open'}.`,
    '',
    `Scoring: ${pct(goals.over25)} for over 2.5 goals and ${pct(goals.btts)} for both teams to score. The home side averages ${statistics.home.xgFor.toFixed(2)} expected goals for and ${statistics.home.xgAgainst.toFixed(2)} against; the away side, ${statistics.away.xgFor.toFixed(2)} and ${statistics.away.xgAgainst.toFixed(2)}. Elo stands at ${statistics.home.elo.toFixed(0)} against ${statistics.away.elo.toFixed(0)}.`,
    '',
    `Confidence is ${(context.confidence * 100).toFixed(0)} out of 100, which describes how much data supports the estimate rather than how likely it is to be right. Dispersion of simulated outcomes puts this fixture at ${riskLevel(context.risk)} risk.`,
    '',
    `On your question — "${question}" — the analyst can only speak to the figures above. Anything about line-ups, injuries or market prices is outside the data it was given.`,
    '',
    'These are probabilities, not predictions of a certain result.',
  ].join('\n');
}
