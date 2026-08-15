/**
 * `POST /api/admin/sports/coverage` — season and coverage diagnostic.
 *
 * Asks the provider which seasons it will actually serve for each configured
 * competition, and stores the answer. This is what replaces assuming a plan's
 * season window in code: the assumption would be a constant that goes stale
 * silently, while this is a reading with a timestamp that anyone can refresh.
 *
 * Body: `{ leagues?: LeagueKey[], force?: boolean }`.
 * Cost: one request per competition that has no current stored reading — three
 * on the full slate, zero while the cache is fresh and `force` is not set.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { isLeagueKey, type LeagueKey } from '@/lib/sports/config';
import { verifyLeagueCoverage } from '@/lib/sports/coverage';
import { codeFromSummary, httpStatusForCode } from '@/lib/sports/errors';
import { isProviderConfigured } from '@/lib/sports/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CoverageBody {
  leagues?: unknown;
  force?: unknown;
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as CoverageBody;

  let leagues: LeagueKey[] | undefined;
  if (body.leagues !== undefined) {
    if (!Array.isArray(body.leagues) || !body.leagues.every((value) => isLeagueKey(value))) {
      return NextResponse.json(
        { error: 'leagues must be an array of supported league keys.' },
        { status: 400 },
      );
    }
    leagues = body.leagues as LeagueKey[];
  }

  if (!isProviderConfigured()) {
    return NextResponse.json(
      {
        error: 'API_NOT_CONFIGURED',
        message: 'No sports provider key is configured; the app is serving demo data.',
      },
      { status: 503 },
    );
  }

  const verification = await verifyLeagueCoverage({
    ...(leagues ? { leagues } : {}),
    force: body.force === true,
  });

  if (verification.status === 'failed') {
    const code = codeFromSummary(verification.errors[0]);
    return NextResponse.json(
      { verification, code },
      { status: httpStatusForCode(code) },
    );
  }

  if (verification.status === 'skipped' && verification.skippedReason === 'RATE_LIMITED') {
    return NextResponse.json({ verification }, { status: 429 });
  }

  return NextResponse.json({ verification }, { status: 200 });
}
