import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/../db';
import { simulationRuns } from '@/../db/schema';
import { getProfile } from '@/lib/auth/server';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'History' };

/**
 * Row level security scopes this to the signed-in user, so no explicit
 * user filter is needed. Returns an empty list rather than throwing when
 * the project is unconfigured; the layout redirects to login in that case.
 */
async function loadRuns() {
  const profile = await getProfile();
  if (!profile) return [];
  return db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.userId, profile.id))
    .orderBy(desc(simulationRuns.createdAt))
    .limit(50);
}

export default async function HistoryPage() {
  const runs = await loadRuns();

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="History"
        description="Every simulation you have run, with the parameters it used."
      />

      {runs.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Simulations you run are stored automatically, so you can compare how an estimate moved as kickoff approached."
          action={<ButtonLink href="/monte-carlo">Run a simulation</ButtonLink>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className="eyebrow px-4 py-3 text-left font-normal">Run</th>
                <th className="eyebrow px-4 py-3 text-right font-normal">Paths</th>
                <th className="eyebrow px-4 py-3 text-right font-normal">Time</th>
                <th className="eyebrow px-4 py-3 text-right font-normal">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-raised/40">
                  <td className="px-4 py-3">
                    <Link href={`/matches/${run.matchId}`} className="text-ink hover:text-alpha">
                      {run.matchId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="tabular px-4 py-3 text-right font-mono text-xs">
                    {run.simulations.toLocaleString('en-US')}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-mono text-xs text-muted">
                    {run.executionTimeMs ? `${run.executionTimeMs} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                    {run.createdAt.toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
