/**
 * `GET /api/sports/fixtures/:id`
 *
 * Everything stored about one fixture: statistics, lineups, injuries, the
 * standings of the two teams, and the latest price per betting line. Fields
 * that were never imported come back as `null` or an empty array — the route
 * does not substitute a plausible value for a missing one.
 */

import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth/server';
import { getFixtureDetail } from '@/lib/sports/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const detail = await getFixtureDetail(id);
    if (!detail) return NextResponse.json({ error: 'Fixture not found.' }, { status: 404 });
    return NextResponse.json({ source: 'database', ...detail });
  } catch {
    return NextResponse.json({ error: 'Fixture data is unavailable right now.' }, { status: 503 });
  }
}
