/**
 * An imported fixture, shown as it actually is.
 *
 * No probabilities, no confidence, no risk — the quantitative engine has not
 * been built yet, so the screen says "Not analyzed" where those would go.
 * Every panel renders an empty state when its data has not been imported: a
 * missing statistic is shown as missing, never as a plausible number.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, DataQualityBadge, LiveDataBadge } from '@/components/ui/badge';
import { formatMatchDate } from '@/lib/utils';
import type { FixtureDetail } from '@/lib/sports/repository';
import type { TeamMatchStatistics } from '@/lib/sports/types';

const STATUS_COPY: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  finished: 'Full time',
  postponed: 'Postponed',
  canceled: 'Cancelled',
  unknown: 'Status unknown',
};

const STAT_ROWS: Array<{ key: keyof TeamMatchStatistics; label: string; digits?: number }> = [
  { key: 'possession', label: 'Possession %' },
  { key: 'totalShots', label: 'Total shots' },
  { key: 'shotsOnGoal', label: 'Shots on target' },
  { key: 'shotsInsideBox', label: 'Shots inside box' },
  { key: 'corners', label: 'Corners' },
  { key: 'offsides', label: 'Offsides' },
  { key: 'fouls', label: 'Fouls' },
  { key: 'yellowCards', label: 'Yellow cards' },
  { key: 'redCards', label: 'Red cards' },
  { key: 'goalkeeperSaves', label: 'Goalkeeper saves' },
  { key: 'passes', label: 'Passes' },
  { key: 'passesPercentage', label: 'Pass accuracy %' },
  { key: 'expectedGoals', label: 'Expected goals', digits: 2 },
];

/** Renders a measurement, or a dash when the provider did not supply one. */
function value(input: number | null, digits = 0): string {
  return input === null ? '—' : input.toFixed(digits);
}

export function RealFixtureDetail({ detail }: { detail: FixtureDetail }) {
  const { fixture, statistics, lineups, injuries, odds, standings } = detail;
  const played = fixture.homeScore !== null && fixture.awayScore !== null;

  const homeLineup = lineups.find((lineup) => lineup.teamId === fixture.homeTeamId) ?? null;
  const awayLineup = lineups.find((lineup) => lineup.teamId === fixture.awayTeamId) ?? null;
  const homeStanding = standings.find((row) => row.teamId === fixture.homeTeamId) ?? null;
  const awayStanding = standings.find((row) => row.teamId === fixture.awayTeamId) ?? null;

  return (
    <>
      <Link href="/matches" className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All matches
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 hairline-top sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{fixture.leagueName}</Badge>
          {fixture.leagueCountry && <Badge>{fixture.leagueCountry}</Badge>}
          {fixture.round && <Badge>{fixture.round}</Badge>}
          <LiveDataBadge />
          <DataQualityBadge status={fixture.dataQuality} />
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {fixture.homeTeam}
          <span className="px-2 font-normal text-muted">vs</span>
          {fixture.awayTeam}
        </h1>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs text-muted">
          <span>{formatMatchDate(fixture.kickoff)}</span>
          <span>
            {STATUS_COPY[fixture.status] ?? fixture.status}
            {fixture.status === 'live' && fixture.elapsed !== null ? ` · ${fixture.elapsed}'` : ''}
          </span>
          {fixture.venue && <span>{fixture.venue}</span>}
        </div>

        {played && (
          <p className="tabular mt-5 font-mono text-4xl">
            {fixture.homeScore}
            <span className="px-2 text-muted">–</span>
            {fixture.awayScore}
          </p>
        )}

        <div className="mt-6 rounded-lg border border-dashed border-line px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Not analyzed</p>
          <p className="mt-1 text-sm text-muted">
            This fixture has been imported but not modelled. Probabilities, confidence and risk
            appear once the quantitative engine runs against it.
          </p>
        </div>

        {fixture.qualityIssues.length > 0 && (
          <p className="mt-3 font-mono text-[11px] text-muted">
            Known gaps: {fixture.qualityIssues.join(', ').replace(/_/g, ' ')}
          </p>
        )}
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Match statistics ------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Match statistics</CardTitle>
            <span className="eyebrow">As reported by the provider</span>
          </CardHeader>
          <CardBody>
            {statistics ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow pb-2 text-left font-normal">{fixture.homeTeam}</th>
                    <th className="eyebrow pb-2 text-center font-normal">Metric</th>
                    <th className="eyebrow pb-2 text-right font-normal">{fixture.awayTeam}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {STAT_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="tabular py-2.5 font-mono">
                        {value(statistics.home[row.key], row.digits)}
                      </td>
                      <td className="py-2.5 text-center text-xs text-muted">{row.label}</td>
                      <td className="tabular py-2.5 text-right font-mono">
                        {value(statistics.away[row.key], row.digits)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>
                No statistics have been imported for this fixture. Providers usually publish them
                once the match is under way.
              </Empty>
            )}
          </CardBody>
        </Card>

        {/* Odds ------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Latest odds</CardTitle>
            <span className="eyebrow">{detail.oddsSnapshotCount} snapshots stored</span>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {odds.length > 0 ? (
              odds.slice(0, 12).map((snapshot) => (
                <div
                  key={`${snapshot.bookmaker}-${snapshot.market}-${snapshot.selection}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="truncate text-xs text-muted">
                    {snapshot.selection}
                    <span className="px-1.5 text-[10px] opacity-70">{snapshot.bookmaker}</span>
                  </span>
                  <span className="tabular shrink-0 font-mono text-sm">
                    {snapshot.decimalOdds.toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <Empty>
                No prices have been captured yet. Odds are stored as a series of snapshots, so this
                panel fills in as the market moves.
              </Empty>
            )}
          </CardBody>
        </Card>

        {/* Lineups ---------------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lineups</CardTitle>
            <span className="eyebrow">
              {homeLineup?.confirmed || awayLineup?.confirmed ? 'Confirmed' : 'Provisional'}
            </span>
          </CardHeader>
          <CardBody>
            {homeLineup || awayLineup ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <TeamLineup name={fixture.homeTeam} lineup={homeLineup} />
                <TeamLineup name={fixture.awayTeam} lineup={awayLineup} />
              </div>
            ) : (
              <Empty>
                Lineups are published about an hour before kickoff and have not been imported yet.
              </Empty>
            )}
          </CardBody>
        </Card>

        {/* League position -------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>League position</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {homeStanding || awayStanding ? (
              <>
                <StandingLine name={fixture.homeTeam} standing={homeStanding} />
                <StandingLine name={fixture.awayTeam} standing={awayStanding} />
              </>
            ) : (
              <Empty>The table for this competition has not been imported yet.</Empty>
            )}
          </CardBody>
        </Card>

        {/* Injuries --------------------------------------------------- */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Unavailable players</CardTitle>
          </CardHeader>
          <CardBody>
            {injuries.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {injuries.map((injury) => (
                  <li key={injury.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{injury.playerName}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">
                      {injury.reason ?? injury.type ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No injury or suspension records have been imported for this fixture.</Empty>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 rounded-xl border border-line bg-surface/50 px-4 py-3 text-xs leading-relaxed text-muted">
        Figures on this page are reported by the data provider and stored unmodified. Where a value
        is missing it is shown as a dash rather than estimated.
      </p>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function TeamLineup({
  name,
  lineup,
}: {
  name: string;
  lineup: FixtureDetail['lineups'][number] | null;
}) {
  return (
    <div>
      <p className="eyebrow">{name}</p>
      {lineup ? (
        <>
          <p className="mt-1 font-mono text-xs text-muted">
            {lineup.formation ?? 'formation unknown'}
            {lineup.coach ? ` · ${lineup.coach}` : ''}
          </p>
          <ol className="mt-3 space-y-1 text-sm">
            {lineup.startingXI.map((player) => (
              <li key={`${player.playerId ?? player.name}`} className="flex gap-2">
                <span className="tabular w-6 font-mono text-xs text-muted">
                  {player.number ?? '—'}
                </span>
                <span className="truncate">{player.name}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Not published.</p>
      )}
    </div>
  );
}

function StandingLine({
  name,
  standing,
}: {
  name: string;
  standing: FixtureDetail['standings'][number] | null;
}) {
  return (
    <div>
      <p className="eyebrow">{name}</p>
      {standing ? (
        <p className="tabular mt-1 font-mono text-sm">
          #{standing.rank}
          <span className="px-2 text-muted">·</span>
          {standing.points} pts
          <span className="px-2 text-muted">·</span>
          {standing.played} played
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Not in the imported table.</p>
      )}
    </div>
  );
}
