import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { RiskPill, DemoBadge } from '@/components/ui/badge';
import { formatKickoff, pct } from '@/lib/utils';
import type { MatchView } from '@/lib/types/domain';

export function MatchCard({ match }: { match: MatchView }) {
  return (
    <Link
      href={`/matches/${match.id}`}
      className="group block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-alpha/40 hairline-top"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow truncate">
          {match.league} · {formatKickoff(match.kickoff)}
        </p>
        {match.demo && <DemoBadge />}
      </div>

      <p className="mt-2.5 font-display text-sm font-semibold leading-snug">
        {match.homeTeam}
        <span className="px-1.5 font-normal text-muted">vs</span>
        {match.awayTeam}
      </p>

      <div className="mt-4">
        <ProbabilityBar
          probabilities={match.probabilities}
          size="md"
          showLabels
          homeLabel={match.homeTeam}
          awayLabel={match.awayTeam}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
        <ConfidenceMeter score={match.confidence} segments={8} className="w-32" />
        <div className="flex items-center gap-2">
          <RiskPill score={match.risk} />
          <ArrowUpRight className="h-4 w-4 text-muted transition-colors group-hover:text-alpha" aria-hidden />
        </div>
      </div>

      <dl className="tabular mt-4 grid grid-cols-4 gap-2 font-mono text-[11px] text-muted">
        <div><dt className="text-[10px]">O1.5</dt><dd className="text-ink">{pct(match.goals.over15, 0)}</dd></div>
        <div><dt className="text-[10px]">O2.5</dt><dd className="text-ink">{pct(match.goals.over25, 0)}</dd></div>
        <div><dt className="text-[10px]">O3.5</dt><dd className="text-ink">{pct(match.goals.over35, 0)}</dd></div>
        <div><dt className="text-[10px]">BTTS</dt><dd className="text-ink">{pct(match.goals.btts, 0)}</dd></div>
      </dl>
    </Link>
  );
}
