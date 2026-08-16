/**
 * An imported fixture, shown as it actually is.
 *
 * No probabilities, no confidence, no risk — the quantitative engine has not
 * been built yet, so the screen says "Not analyzed" where those would go.
 * Every panel renders an empty state when its data has not been imported: a
 * missing statistic is shown as missing, never as a plausible number.
 *
 * The section strip matches the modelled screen's, so the two modes differ
 * in what they contain rather than in how they are read. The sections that
 * need model output are marked unavailable instead of being hidden — a
 * reader who expects a probability should find out why it is absent.
 */
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { Badge, DataQualityBadge, LiveDataBadge } from '@/components/ui/badge';
import { EmptyState, Note } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { MatchHeader } from '@/components/app/match-header';
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

  const homeLineup = lineups.find((lineup) => lineup.teamId === fixture.homeTeamId) ?? null;
  const awayLineup = lineups.find((lineup) => lineup.teamId === fixture.awayTeamId) ?? null;
  const homeStanding = standings.find((row) => row.teamId === fixture.homeTeamId) ?? null;
  const awayStanding = standings.find((row) => row.teamId === fixture.awayTeamId) ?? null;

  return (
    <>
      <MatchHeader
        league={fixture.leagueName}
        country={fixture.leagueCountry}
        round={fixture.round}
        kickoff={fixture.kickoff}
        homeTeam={fixture.homeTeam}
        awayTeam={fixture.awayTeam}
        homeLogo={fixture.homeLogo}
        awayLogo={fixture.awayLogo}
        homeScore={fixture.homeScore}
        awayScore={fixture.awayScore}
        status={STATUS_COPY[fixture.status] ?? fixture.status}
        live={fixture.status === 'live'}
        elapsed={fixture.elapsed}
        venue={fixture.venue}
        badges={
          <>
            <LiveDataBadge />
            <DataQualityBadge status={fixture.dataQuality} />
          </>
        }
      />

      <Tabs
        className="mt-5"
        label="Fixture sections"
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            icon: 'dashboard',
            panel: (
              <Overview
                fixture={fixture}
                homeStanding={homeStanding}
                awayStanding={awayStanding}
                injuries={injuries}
              />
            ),
          },
          {
            id: 'probability',
            label: 'Probability',
            icon: 'sigma',
            panel: <NotAnalyzed />,
          },
          {
            id: 'statistics',
            label: 'Statistics',
            icon: 'apiUsage',
            panel: (
              <Statistics
                fixture={fixture}
                statistics={statistics}
                homeLineup={homeLineup}
                awayLineup={awayLineup}
              />
            ),
          },
          {
            id: 'monte-carlo',
            label: 'Monte Carlo',
            icon: 'simulation',
            disabled: true,
            panel: null,
          },
          {
            id: 'market',
            label: 'Market',
            icon: 'wallet',
            panel: <Market odds={odds} snapshots={detail.oddsSnapshotCount} />,
          },
          {
            id: 'ai',
            label: 'AI Analysis',
            icon: 'analyst',
            disabled: true,
            panel: null,
          },
        ]}
      />

      <Note className="mt-6">
        Figures on this page are reported by the data provider and stored unmodified. Where a value is
        missing it is shown as a dash rather than estimated.
      </Note>
    </>
  );
}

/* ------------------------------------------------------------------
   Overview.
   ------------------------------------------------------------------ */

function Overview({
  fixture,
  homeStanding,
  awayStanding,
  injuries,
}: {
  fixture: FixtureDetail['fixture'];
  homeStanding: FixtureDetail['standings'][number] | null;
  awayStanding: FixtureDetail['standings'][number] | null;
  injuries: FixtureDetail['injuries'];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Model output</CardTitle>
          <CardDescription>Not analyzed</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="max-w-2xl text-small text-muted">
            This fixture has been imported but not modelled. Probabilities, confidence and risk
            appear once the quantitative engine runs against it — until then the sections that would
            show them are marked unavailable rather than filled with an estimate.
          </p>
          {fixture.qualityIssues.length > 0 && (
            <div className="rounded-lg border border-line bg-raised/40 px-3 py-2.5">
              <p className="eyebrow">Known gaps in the record</p>
              <p className="mt-1 font-mono text-fine leading-relaxed text-muted">
                {fixture.qualityIssues.join(', ').replace(/_/g, ' ')}
              </p>
            </div>
          )}
        </CardBody>
      </Card>

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

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Unavailable players</CardTitle>
          <CardDescription>{injuries.length} recorded</CardDescription>
        </CardHeader>
        <CardBody>
          {injuries.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {injuries.map((injury) => (
                <li
                  key={injury.id}
                  className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-small last:border-0 last:pb-0"
                >
                  <span className="min-w-0 truncate">{injury.playerName}</span>
                  <span className="shrink-0 font-mono text-fine text-muted">
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
  );
}

/* ------------------------------------------------------------------
   Probability — the one section whose absence needs explaining, so it is
   reachable rather than greyed out.
   ------------------------------------------------------------------ */

function NotAnalyzed() {
  return (
    <EmptyState
      icon="sigma"
      title="Not analyzed."
      description="Imported fixtures carry no model output yet. Probabilities, fair odds, simulation and the AI explanation all follow from the quantitative engine, which is not connected to live data. The sample fixtures show the full layout in the meantime."
      action={
        <ButtonLink href="/matches" variant="secondary" size="sm" icon="matches">
          Back to matches
        </ButtonLink>
      }
    />
  );
}

/* ------------------------------------------------------------------
   Statistics and lineups — reported, not derived.
   ------------------------------------------------------------------ */

function Statistics({
  fixture,
  statistics,
  homeLineup,
  awayLineup,
}: {
  fixture: FixtureDetail['fixture'];
  statistics: FixtureDetail['statistics'];
  homeLineup: FixtureDetail['lineups'][number] | null;
  awayLineup: FixtureDetail['lineups'][number] | null;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Match statistics</CardTitle>
          <CardDescription>As reported by the provider</CardDescription>
        </CardHeader>
        <CardBody>
          {statistics ? (
            <table className="w-full text-small">
              <caption className="sr-only">
                {fixture.homeTeam} compared with {fixture.awayTeam}, as reported
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="eyebrow pb-2 text-left font-normal">
                    {fixture.homeTeam}
                  </th>
                  <th scope="col" className="eyebrow pb-2 text-center font-normal">
                    Metric
                  </th>
                  <th scope="col" className="eyebrow pb-2 text-right font-normal">
                    {fixture.awayTeam}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {STAT_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td className="tabular py-2.5 font-mono">
                      {value(statistics.home[row.key], row.digits)}
                    </td>
                    <td className="py-2.5 text-center text-fine text-muted">{row.label}</td>
                    <td className="tabular py-2.5 text-right font-mono">
                      {value(statistics.away[row.key], row.digits)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>
              No statistics have been imported for this fixture. Providers usually publish them once
              the match is under way.
            </Empty>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lineups</CardTitle>
          <CardDescription>
            {homeLineup?.confirmed || awayLineup?.confirmed ? 'Confirmed' : 'Provisional'}
          </CardDescription>
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
    </div>
  );
}

/* ------------------------------------------------------------------
   Market — stored price snapshots, newest first as the repository returns
   them.
   ------------------------------------------------------------------ */

function Market({
  odds,
  snapshots,
}: {
  odds: FixtureDetail['odds'];
  snapshots: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest odds</CardTitle>
        <CardDescription>{snapshots} snapshots stored</CardDescription>
      </CardHeader>
      <CardBody>
        {odds.length > 0 ? (
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {odds.slice(0, 12).map((snapshot) => (
              <li
                key={`${snapshot.bookmaker}-${snapshot.market}-${snapshot.selection}`}
                className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-small"
              >
                <span className="min-w-0 truncate text-muted">
                  {snapshot.selection}
                  <span className="pl-2 font-mono text-micro opacity-70">
                    {snapshot.bookmaker}
                  </span>
                </span>
                <span className="tabular shrink-0 font-mono">
                  {snapshot.decimalOdds.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No prices have been captured yet. Odds are stored as a series of snapshots, so this panel
            fills in as the market moves.
          </Empty>
        )}
      </CardBody>
      {odds.length > 0 && (
        <CardBody className="border-t border-line pt-3">
          <Badge variant="info">Reported prices</Badge>
          <p className="mt-2 text-fine leading-relaxed text-muted">
            Prices are stored as captured and are not compared with a model probability — value
            against the market needs both, and only one of the two exists for this fixture.
          </p>
        </CardBody>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------
   Shared small parts.
   ------------------------------------------------------------------ */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-small text-muted">
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
          <p className="mt-1 font-mono text-fine text-muted">
            {lineup.formation ?? 'formation unknown'}
            {lineup.coach ? ` · ${lineup.coach}` : ''}
          </p>
          <ol className="mt-3 space-y-1 text-small">
            {lineup.startingXI.map((player) => (
              <li key={`${player.playerId ?? player.name}`} className="flex gap-2">
                <span className="tabular w-6 font-mono text-fine text-muted">
                  {player.number ?? '—'}
                </span>
                <span className="min-w-0 truncate">{player.name}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 text-small text-muted">Not published.</p>
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
        <p className="tabular mt-1 font-mono text-small">
          #{standing.rank}
          <span className="px-2 text-muted">·</span>
          {standing.points} pts
          <span className="px-2 text-muted">·</span>
          {standing.played} played
        </p>
      ) : (
        <p className="mt-1 text-small text-muted">Not in the imported table.</p>
      )}
    </div>
  );
}
