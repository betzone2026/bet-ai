import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/../db';
import { simulationRuns } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { getPlan } from '@/lib/config/plans';
import { getDemoMatch } from '@/lib/demo/matches';
import { runServerSimulation } from '@/lib/simulation/server-engine';
import { reserveUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Log in to run simulations.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    matchId?: string;
    simulations?: number;
    homeAdvantage?: number;
    seed?: number;
  } | null;
  const match = body?.matchId ? getDemoMatch(body.matchId) : null;
  if (!match) return NextResponse.json({ error: 'That match is not in the catalogue.' }, { status: 404 });

  const simulations = Math.trunc(body?.simulations ?? 0);
  const homeAdvantage = body?.homeAdvantage ?? 0.15;
  const limits = getPlan(profile.plan).limits;
  if (simulations < 1 || simulations > limits.monteCarloLimit) {
    return NextResponse.json({ error: 'The requested path count exceeds your plan limit.' }, { status: 400 });
  }
  if (!Number.isFinite(homeAdvantage) || homeAdvantage < 0 || homeAdvantage > 1) {
    return NextResponse.json({ error: 'Home advantage must be between 0 and 1.' }, { status: 400 });
  }

  const reserved = await reserveUsage(profile.id, 'monte_carlo', limits.monteCarloRunsDaily);
  if (!reserved) {
    return NextResponse.json({ error: 'Today’s simulation allowance has been used.' }, { status: 429 });
  }

  const result = runServerSimulation({ match, simulations, homeAdvantage, seed: body?.seed });
  const id = randomUUID();
  await db.insert(simulationRuns).values({
    id,
    userId: profile.id,
    matchId: match.id,
    simulations,
    inputParameters: { homeAdvantage, seed: body?.seed ?? null },
    results: result as unknown as Record<string, unknown>,
    executionTimeMs: result.executionTimeMs,
  });

  return NextResponse.json({ id, ...result }, { status: 201 });
}
