/**
 * `GET /api/sports/leagues`
 *
 * The competitions SportAlpha covers, and which of them have actually been
 * imported. `supported` comes from the central configuration; `leagues` is what
 * the database holds, so an empty array before the first sync is expected
 * rather than an error.
 */

import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { SUPPORTED_LEAGUES, SUPPORTED_LEAGUE_KEYS } from '@/lib/sports/config';
import { listStoredLeagues } from '@/lib/sports/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supported = SUPPORTED_LEAGUE_KEYS.map((key) => ({
    key,
    name: SUPPORTED_LEAGUES[key].name,
    country: SUPPORTED_LEAGUES[key].country,
    type: SUPPORTED_LEAGUES[key].type,
  }));

  try {
    const leagues = await listStoredLeagues();
    return NextResponse.json({ source: 'database', supported, leagues });
  } catch {
    return NextResponse.json({ error: 'Leagues are unavailable right now.' }, { status: 503 });
  }
}
