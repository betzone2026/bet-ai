/**
 * `GET /api/sports/standings?league=serie_a&season=2025`
 *
 * Stored league tables. `league` accepts a SportAlpha league key (`serie_a`) or
 * an internal league id. When `season` is omitted every stored season is
 * returned, ordered by season then rank.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { listStandings } from '@/lib/sports/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const league = request.nextUrl.searchParams.get('league');
  if (!league) {
    return NextResponse.json({ error: 'A league is required.' }, { status: 400 });
  }

  const rawSeason = Number.parseInt(request.nextUrl.searchParams.get('season') ?? '', 10);
  const season = Number.isInteger(rawSeason) ? rawSeason : undefined;

  try {
    const standings = await listStandings(league, season);
    return NextResponse.json({
      source: 'database',
      league,
      season: season ?? null,
      count: standings.length,
      standings,
    });
  } catch {
    return NextResponse.json({ error: 'Standings are unavailable right now.' }, { status: 503 });
  }
}
