/**
 * `POST /api/admin/sports/sync`
 *
 * The only endpoint in the application that can cause an outbound provider
 * request, and therefore the only one that spends quota. Admin-only: the
 * Netlify redirect rules gate `/admin/*` pages by role, but `/api/*` is not
 * covered by them, so the check is made here explicitly.
 *
 * Body: `{ date?: "YYYY-MM-DD", leagues?: LeagueKey[], syncType?: "fixtures" |
 * "standings" | "fixture-detail", fixtureId?: string, force?: boolean }`.
 *
 * When `API_FOOTBALL_KEY` is absent the route answers 503 with
 * `API_NOT_CONFIGURED` rather than failing — a missing key is a configuration
 * state, not a crash.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { isLeagueKey, type LeagueKey } from '@/lib/sports/config';
import { codeFromSummary, httpStatusForCode } from '@/lib/sports/errors';
import { isProviderConfigured } from '@/lib/sports/registry';
import { syncFixtureDetail } from '@/lib/sports/sync/fixture-detail';
import { syncFixtures } from '@/lib/sports/sync/fixtures';
import { syncStandings } from '@/lib/sports/sync/standings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SYNC_TYPES = ['fixtures', 'standings', 'fixture-detail'] as const;
type SyncType = (typeof SYNC_TYPES)[number];

/** Whatever a sync service returns, viewed through what the route needs. */
interface SyncOutcome {
  status: string;
  errors: string[];
  skippedReason?: string;
}

/**
 * Answers with the status that matches the actual failure.
 *
 * A blanket 502 for every unsuccessful run hides the difference between a spent
 * quota, a rejected key and a plan that does not cover the request — three
 * things an admin resolves in three different ways. The code is recovered from
 * the summary line the sync already recorded, so the mapping lives in one place
 * rather than being restated per endpoint.
 */
function respond(syncType: SyncType, summary: SyncOutcome): NextResponse {
  if (summary.status !== 'failed') {
    // A run skipped because the allowance is gone is not an error, but it did
    // not do the work either — say so with the rate-limit status.
    if (summary.status === 'skipped' && summary.skippedReason === 'RATE_LIMITED') {
      return NextResponse.json({ syncType, summary }, { status: 429 });
    }
    return NextResponse.json({ syncType, summary }, { status: 200 });
  }

  const code = codeFromSummary(summary.errors[0]);
  return NextResponse.json(
    { syncType, summary, code },
    { status: httpStatusForCode(code) },
  );
}

interface SyncBody {
  date?: unknown;
  leagues?: unknown;
  syncType?: unknown;
  fixtureId?: unknown;
  season?: unknown;
  force?: unknown;
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as SyncBody;

  const syncType: SyncType = SYNC_TYPES.includes(body.syncType as SyncType)
    ? (body.syncType as SyncType)
    : 'fixtures';

  if (body.date !== undefined && (typeof body.date !== 'string' || !DATE_PATTERN.test(body.date))) {
    return NextResponse.json({ error: 'date must be formatted YYYY-MM-DD.' }, { status: 400 });
  }

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

  const triggeredBy = profile.id;
  const force = body.force === true;

  if (syncType === 'fixture-detail') {
    if (typeof body.fixtureId !== 'string' || body.fixtureId === '') {
      return NextResponse.json(
        { error: 'fixtureId is required for a fixture-detail sync.' },
        { status: 400 },
      );
    }
    const summary = await syncFixtureDetail({ fixtureId: body.fixtureId, triggeredBy });
    return respond(syncType, summary);
  }

  if (syncType === 'standings') {
    const season = typeof body.season === 'number' && Number.isInteger(body.season)
      ? body.season
      : undefined;
    const summary = await syncStandings({
      ...(leagues ? { leagues } : {}),
      ...(season !== undefined ? { season } : {}),
      triggeredBy,
      force,
    });
    return respond(syncType, summary);
  }

  const summary = await syncFixtures({
    ...(typeof body.date === 'string' ? { date: body.date } : {}),
    ...(leagues ? { leagues } : {}),
    syncType: 'fixtures',
    triggeredBy,
    force,
  });

  return respond(syncType, summary);
}
