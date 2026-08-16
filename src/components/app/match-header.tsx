import Link from 'next/link';
import { AppIcon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { TeamCrest } from '@/components/app/team-crest';
import { formatMatchDate } from '@/lib/utils';

/**
 * The header both fixture screens open with.
 *
 * One shape for a modelled fixture and an imported one, so moving between
 * the two modes never feels like moving between two products. The centre
 * column carries the score once there is one and the kickoff time until
 * then — the same slot, because that is the same question asked before and
 * after the match.
 */
export function MatchHeader({
  league,
  country,
  round,
  kickoff,
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeScore,
  awayScore,
  status,
  live = false,
  elapsed,
  venue,
  badges,
  actions,
  backHref = '/matches',
  backLabel = 'All matches',
}: {
  league: string;
  country?: string | null;
  round?: string | null;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Display copy for the fixture state, already humanised by the caller. */
  status?: string;
  live?: boolean;
  elapsed?: number | null;
  venue?: string | null;
  /** Provenance badges — data status, record quality, demo marker. */
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const played = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;

  return (
    <header className="rounded-xl border border-line bg-surface shadow-card hairline-top">
      {/* The two team names are laid out either side of the score, which is
          the wrong shape for a heading, so the page's single h1 states the
          fixture once for assistive technology and the visible names are
          plain text. */}
      <h1 className="sr-only">
        {homeTeam} versus {awayTeam}, {league}
      </h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-small text-muted transition-colors duration-fast hover:text-ink"
        >
          <AppIcon name="back" size={16} />
          {backLabel}
        </Link>
        <span aria-hidden className="h-4 w-px bg-line" />
        <p className="eyebrow min-w-0 truncate">
          {league}
          {country ? ` · ${country}` : ''}
          {round ? ` · ${round}` : ''}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">{badges}</div>
      </div>

      {/* Home · result · away. The grid keeps the centre column centred
          on the card rather than between two names of unequal length. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5 sm:gap-6 sm:py-6">
        <TeamSide name={homeTeam} logo={homeLogo} side="home" />

        <div className="min-w-0 text-center">
          {played ? (
            <p className="tabular font-mono text-data leading-none sm:text-display">
              {homeScore}
              <span className="px-1.5 text-muted sm:px-2.5">–</span>
              {awayScore}
            </p>
          ) : (
            <p className="tabular font-mono text-body leading-none text-ink-2 sm:text-h2">vs</p>
          )}
          {live ? (
            <Badge variant="danger" dot className="mt-2">
              {elapsed !== null && elapsed !== undefined ? `${elapsed}'` : 'Live'}
            </Badge>
          ) : (
            status && <p className="mt-2 font-mono text-fine text-muted">{status}</p>
          )}
        </div>

        <TeamSide name={awayTeam} logo={awayLogo} side="away" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3">
        <p className="font-mono text-fine text-muted">{formatMatchDate(kickoff)}</p>
        {venue && <p className="min-w-0 truncate font-mono text-fine text-muted">{venue}</p>}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A side of the fixture. Both sides read outwards from the centre on wide
 * screens and stack under their crest on narrow ones, which keeps the two
 * names balanced instead of pushing the away side off the edge at 320px.
 */
function TeamSide({
  name,
  logo,
  side,
}: {
  name: string;
  logo?: string | null;
  side: 'home' | 'away';
}) {
  return (
    <div
      className={
        side === 'home'
          ? 'flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3'
          : 'flex min-w-0 flex-col items-center gap-2 sm:flex-row-reverse sm:items-center sm:gap-3'
      }
    >
      <TeamCrest name={name} logo={logo} size={40} />
      <p
        className={
          side === 'home'
            ? 'min-w-0 font-display text-body font-semibold leading-tight sm:text-h2 sm:text-left'
            : 'min-w-0 font-display text-body font-semibold leading-tight sm:text-h2 sm:text-right'
        }
      >
        {name}
      </p>
    </div>
  );
}
