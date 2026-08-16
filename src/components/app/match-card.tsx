import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { AppIcon } from '@/components/ui/icon';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { RiskBadge, DemoBadge } from '@/components/ui/badge';
import { TeamCrest } from '@/components/app/team-crest';
import { formatKickoff, impliedOdds, pct } from '@/lib/utils';
import type { MatchView } from '@/lib/types/domain';

/**
 * A fixture that carries model output: distribution, confidence, risk and
 * the fair price the probabilities imply.
 *
 * The card is not itself a link. One labelled action — "Analyse" — owns
 * the navigation and stretches its own hit area over the whole card via
 * `after:inset-0`, so the card is tappable everywhere while a screen
 * reader is offered exactly one link with a name that says which fixture
 * it opens.
 */
export function MatchCard({ match }: { match: MatchView }) {
  const leader = leadingOutcome(match);
  const fair = impliedOdds(leader.probability);

  return (
    <Card variant="interactive" className="group relative flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <p className="eyebrow truncate">{match.league}</p>
        <div className="flex shrink-0 items-center gap-2">
          {match.demo && <DemoBadge />}
          <span className="tabular font-mono text-small text-ink-2">
            {formatKickoff(match.kickoff)}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2 px-4">
        <TeamRow name={match.homeTeam} score={match.homeScore} />
        <TeamRow name={match.awayTeam} score={match.awayScore} />
      </div>

      <div className="mt-4 px-4">
        <ProbabilityBar
          probabilities={match.probabilities}
          size="md"
          showLabels
          homeLabel={match.homeTeam}
          awayLabel={match.awayTeam}
        />
      </div>

      <dl className="tabular mt-4 grid grid-cols-4 gap-2 px-4 font-mono text-fine">
        <Goal label="O1.5" value={match.goals.over15} />
        <Goal label="O2.5" value={match.goals.over25} />
        <Goal label="O3.5" value={match.goals.over35} />
        <Goal label="BTTS" value={match.goals.btts} />
      </dl>

      <div className="mt-4 flex items-end justify-between gap-4 border-t border-line px-4 py-3">
        <ConfidenceMeter score={match.confidence} segments={8} className="w-28 shrink-0" />

        <div className="flex flex-col items-end gap-1.5">
          <RiskBadge score={match.risk} />
          {fair !== null && (
            <span className="tabular font-mono text-fine text-muted">
              Fair {leader.tick} {fair.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/matches/${match.id}`}
        aria-label={`Analyse ${match.homeTeam} versus ${match.awayTeam}`}
        className="flex min-h-touch items-center justify-center gap-1.5 rounded-b-xl border-t border-line bg-raised/50 text-small font-medium text-ink-2 transition-colors duration-fast after:absolute after:inset-0 after:content-[''] group-hover:bg-raised group-hover:text-alpha sm:min-h-0 sm:h-10"
      >
        Analyse
        <AppIcon name="forward" size={16} />
      </Link>
    </Card>
  );
}

function TeamRow({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamCrest name={name} size={24} />
      <span className="min-w-0 flex-1 truncate font-display text-body font-semibold">{name}</span>
      {score !== null && (
        <span className="tabular shrink-0 font-mono text-body text-ink">{score}</span>
      )}
    </div>
  );
}

function Goal({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-micro text-muted">{label}</dt>
      <dd className="text-ink">{pct(value, 0)}</dd>
    </div>
  );
}

/** The outcome the model favours, used for the fair-price readout. */
function leadingOutcome({ probabilities }: MatchView): { tick: string; probability: number } {
  const { home, draw, away } = probabilities;
  if (home >= draw && home >= away) return { tick: '1', probability: home };
  if (away >= draw) return { tick: '2', probability: away };
  return { tick: 'X', probability: draw };
}
