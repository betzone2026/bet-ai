import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DataQualityBadge } from '@/components/ui/badge';
import { formatKickoff } from '@/lib/utils';
import type { FixtureListItem } from '@/lib/sports/repository';

const STATUS_COPY: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  finished: 'Full time',
  postponed: 'Postponed',
  canceled: 'Cancelled',
  unknown: 'Status unknown',
};

/**
 * A fixture as imported — teams, kickoff, score, nothing modelled.
 *
 * Where `MatchCard` shows probability bars, this card shows "Analysis pending".
 * The quantitative engine arrives in a later step; until it does, an empty
 * space is the honest reading and a number would be a fabricated one.
 */
export function FixtureCard({ fixture }: { fixture: FixtureListItem }) {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;

  return (
    <Link
      href={`/matches/${fixture.id}`}
      className="group block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-alpha/40 hairline-top"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow truncate">
          {fixture.leagueName} · {formatKickoff(fixture.kickoff)}
        </p>
        {fixture.dataQuality !== 'GOOD' && <DataQualityBadge status={fixture.dataQuality} />}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-3">
        <p className="font-display text-sm font-semibold leading-snug">
          {fixture.homeTeam}
          <span className="px-1.5 font-normal text-muted">vs</span>
          {fixture.awayTeam}
        </p>
        {played && (
          <p className="tabular shrink-0 font-mono text-sm text-ink">
            {fixture.homeScore}–{fixture.awayScore}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-line px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Analysis pending
        </p>
        <p className="mt-1 text-xs text-muted">
          No model output for this fixture yet.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="font-mono text-[11px] text-muted">
          {STATUS_COPY[fixture.status] ?? fixture.status}
          {fixture.status === 'live' && fixture.elapsed !== null ? ` · ${fixture.elapsed}'` : ''}
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted transition-colors group-hover:text-alpha" aria-hidden />
      </div>
    </Link>
  );
}
