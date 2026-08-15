/**
 * `POST /api/admin/sports/preview` — "Check fixtures".
 *
 * A dry run of the fixtures import: it spends exactly one provider request and
 * writes no fixture. What comes back is the pair of numbers that makes a wrong
 * league id distinguishable from a quiet day — how many fixtures the provider
 * returned, and how many of them SportAlpha matched — plus every competition
 * seen in the response, so the configured provider ids can be checked against
 * what the provider actually calls them.
 *
 * Admin-only, for the same reason the sync route is: `/api/*` is not covered by
 * the redirect rules that gate `/admin/*` pages, so the check is made here.
 *
 * Body: `{ date?: "YYYY-MM-DD", leagues?: LeagueKey[] }`.
 * Cost: 1 API request.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { isLeagueKey, type LeagueKey } from '@/lib/sports/config';
import { validateSyncDate } from '@/lib/sports/dates';
import { codeFromSummary, httpStatusForCode } from '@/lib/sports/errors';
import { previewFixtures } from '@/lib/sports/preview';
import { isProviderConfigured } from '@/lib/sports/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Requests one check costs, stated so the caller can show it before spending. */
const REQUEST_COST = 1;

interface PreviewBody {
  date?: unknown;
  leagues?: unknown;
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = ((await request.json().catch(() => null)) ?? {}) as PreviewBody;

  const chosenDate = validateSyncDate(body.date);
  if (!chosenDate.ok) {
    return NextResponse.json({ error: chosenDate.reason }, { status: 400 });
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

  const preview = await previewFixtures({
    date: chosenDate.date,
    ...(leagues ? { leagues } : {}),
  });

  if (preview.status === 'failed') {
    const code = codeFromSummary(preview.errors[0]);
    return NextResponse.json(
      { preview, requestCost: REQUEST_COST, code },
      { status: httpStatusForCode(code) },
    );
  }

  // A check that was refused because the allowance is gone did not do the work,
  // and saying so with 429 is what lets the caller tell it from a real result.
  if (preview.status === 'skipped' && preview.skippedReason === 'RATE_LIMITED') {
    return NextResponse.json({ preview, requestCost: 0 }, { status: 429 });
  }

  return NextResponse.json(
    { preview, requestCost: preview.apiRequests },
    { status: 200 },
  );
}
