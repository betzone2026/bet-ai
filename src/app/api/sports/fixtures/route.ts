/**
 * `GET /api/sports/fixtures`
 *
 * The browser's only route to sports data. It reads the database — never the
 * upstream provider — so the request path is:
 *
 *   Browser → SportAlpha API → Database
 *
 * A provider call is triggered exclusively by the admin sync endpoint, which
 * keeps the API key on the server and the quota under our control.
 *
 * Query parameters: `date` (YYYY-MM-DD), `from`, `to`, `league` (slug),
 * `limit` (1–200).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { listFixtures } from '@/lib/sports/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` as a UTC instant, rejecting anything else. */
function parseDate(value: string | null): Date | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(start: Date): Date {
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const day = parseDate(params.get('date'));
  const from = day ?? parseDate(params.get('from'));
  const to = day ? endOfDay(day) : parseDate(params.get('to'));

  const rawLimit = Number.parseInt(params.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;

  const league = params.get('league');

  try {
    const fixtures = await listFixtures({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(league ? { league } : {}),
      limit,
    });

    return NextResponse.json({
      source: 'database',
      count: fixtures.length,
      fixtures,
    });
  } catch {
    // An empty result is a legitimate answer before the first sync; a database
    // failure is not, and the caller should be able to tell them apart.
    return NextResponse.json({ error: 'Fixtures are unavailable right now.' }, { status: 503 });
  }
}
