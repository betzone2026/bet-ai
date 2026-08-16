import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { AppIcon } from '@/components/ui/icon';
import { Badge, DataQualityBadge } from '@/components/ui/badge';
import { TeamCrest } from '@/components/app/team-crest';
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
 * A fixture as imported — teams, crests, kickoff, score, nothing modelled.
 *
 * Where `MatchCard` shows a distribution, this card says so plainly.
 * The quantitative engine arrives in a later step; until it does, a
 * stated absence is the honest reading and a number would be an invented
 * one. It shares the other card's anatomy so a mixed grid still scans as
 * one list.
 */
export function FixtureCard({ fixture }: { fixture: FixtureListItem }) {
  const played = fixture.homeScore !== null && fixture.awayScore !== null;
  const live = fixture.status === 'live';

  return (
    <Card variant="interactive" className="group relative flex flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <p className="eyebrow truncate">{fixture.leagueName}</p>
        <div className="flex shrink-0 items-center gap-2">
          {fixture.dataQuality !== 'GOOD' && <DataQualityBadge status={fixture.dataQuality} />}
          {live ? (
            <Badge variant="danger" dot>
              {fixture.elapsed !== null ? `${fixture.elapsed}'` : 'Live'}
            </Badge>
          ) : (
            <span className="tabular font-mono text-small text-ink-2">
              {formatKickoff(fixture.kickoff)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2 px-4">
        <TeamRow name={fixture.homeTeam} logo={fixture.homeLogo} score={fixture.homeScore} />
        <TeamRow name={fixture.awayTeam} logo={fixture.awayLogo} score={fixture.awayScore} />
      </div>

      <div className="mt-4 flex-1 px-4">
        <div className="rounded-lg border border-dashed border-line px-3 py-2.5">
          <p className="eyebrow">Analysis pending</p>
          <p className="mt-1 text-small text-muted">No model output for this fixture yet.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="font-mono text-fine text-muted">
          {STATUS_COPY[fixture.status] ?? fixture.status}
          {played ? ' · Result stored' : ''}
        </span>
        {fixture.round && (
          <span className="truncate font-mono text-fine text-muted">{fixture.round}</span>
        )}
      </div>

      <Link
        href={`/matches/${fixture.id}`}
        aria-label={`Open ${fixture.homeTeam} versus ${fixture.awayTeam}`}
        className="flex min-h-touch items-center justify-center gap-1.5 rounded-b-xl border-t border-line bg-raised/50 text-small font-medium text-ink-2 transition-colors duration-fast after:absolute after:inset-0 after:content-[''] group-hover:bg-raised group-hover:text-alpha sm:min-h-0 sm:h-10"
      >
        Open fixture
        <AppIcon name="forward" size={16} />
      </Link>
    </Card>
  );
}

function TeamRow({
  name,
  logo,
  score,
}: {
  name: string;
  logo: string | null;
  score: number | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamCrest name={name} logo={logo} size={24} />
      <span className="min-w-0 flex-1 truncate font-display text-body font-semibold">{name}</span>
      {score !== null && (
        <span className="tabular shrink-0 font-mono text-body text-ink">{score}</span>
      )}
    </div>
  );
}
