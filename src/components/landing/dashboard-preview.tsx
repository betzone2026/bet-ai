import { ProbabilityBar } from '@/components/ui/probability-bar';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { RiskPill, DemoBadge } from '@/components/ui/badge';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { formatKickoff, pct } from '@/lib/utils';

/** A static rendering of the real dashboard components, not a mock-up. */
export function DashboardPreview() {
  const rows = DEMO_MATCHES.slice(0, 4);

  return (
    <section id="product" className="border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-shell px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The terminal</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Every fixture, one readout
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            The same distribution strip appears everywhere a fixture does, so the shape of a
            match is readable before you look at a single number.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface hairline-top">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-up" />
              <span className="eyebrow">Today&apos;s analysis</span>
            </div>
            <DemoBadge />
          </div>

          <div className="divide-y divide-line">
            {rows.map((match) => (
              <div key={match.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {match.league} &middot; {formatKickoff(match.kickoff)}
                  </p>
                  <p className="mt-1 truncate font-display text-sm font-semibold">
                    {match.homeTeam} <span className="text-muted">vs</span> {match.awayTeam}
                  </p>
                  <div className="mt-2.5 max-w-sm">
                    <ProbabilityBar probabilities={match.probabilities} size="sm" />
                  </div>
                </div>

                <div className="tabular flex items-center gap-5 font-mono text-xs">
                  <span><span className="text-muted">1 </span>{pct(match.probabilities.home, 0)}</span>
                  <span><span className="text-muted">X </span>{pct(match.probabilities.draw, 0)}</span>
                  <span><span className="text-muted">2 </span>{pct(match.probabilities.away, 0)}</span>
                </div>

                <div className="flex items-center gap-4 md:justify-end">
                  <ConfidenceMeter score={match.confidence} segments={6} className="w-24" />
                  <RiskPill score={match.risk} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
