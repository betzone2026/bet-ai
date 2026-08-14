import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/../db';
import { simulationRuns } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [run] = await db
    .select()
    .from(simulationRuns)
    .where(and(eq(simulationRuns.id, id), eq(simulationRuns.userId, profile.id)))
    .limit(1);
  if (!run) return NextResponse.json({ error: 'Simulation not found.' }, { status: 404 });
  return NextResponse.json({ id: run.id, ...run.results });
}
