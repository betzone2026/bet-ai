/**
 * The demo fixture screen: the full modelled layout, driven by the sample
 * dataset. It is shown only when no real fixture matches the id, and every
 * figure on it carries the demo badge.
 *
 * The panels are the same ones the real screen uses; only the source of the
 * numbers differs. Sections are tabbed rather than stacked because a
 * modelled fixture carries six distinct readings and a single column of
 * them buries the one the reader came for.
 */
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { ProbabilityBar, OutcomeDistribution } from '@/components/ui/probability-bar';
import { ConfidenceScore } from '@/components/ui/confidence-meter';
import { BarRow, ProgressBar } from '@/components/ui/progress';
import { RiskBadge, DemoBadge, Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Note } from '@/components/ui/states';
import { MatchHeader } from '@/components/app/match-header';
import { formatKickoff, pct, impliedOdds } from '@/lib/utils';
import type { MatchView, TeamStats } from '@/lib/types/domain';

export function DemoMatchDetail({ match }: { match: MatchView }) {
  const outcomes = [
    { key: 'home', label: match.homeTeam, tick: '1', value: match.probabilities.home },
    { key: 'draw', label: 'Draw', tick: 'X', value: match.probabilities.draw },
    { key: 'away', label: match.awayTeam, tick: '2', value: match.probabilities.away },
  ];

  const goalsMarkets = [
    { label: 'Over 1.5', value: match.goals.over15 },
    { label: 'Over 2.5', value: match.goals.over25 },
    { label: 'Over 3.5', value: match.goals.over35 },
    { label: 'Both teams to score', value: match.goals.btts },
  ];

  return (
    <>
      <MatchHeader
        league={match.league}
        country={match.country}
        kickoff={match.kickoff}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        status={formatKickoff(match.kickoff)}
        badges={<DemoBadge />}
        actions={
          <>
            <ButtonLink href={`/monte-carlo?match=${match.id}`} size="sm" variant="secondary" icon="simulation">
              Run simulation
            </ButtonLink>
            <ButtonLink href={`/ai-analyst?match=${match.id}`} size="sm" icon="analyst">
              Ask the analyst
            </ButtonLink>
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
            panel: <Overview match={match} />,
          },
          {
            id: 'probability',
            label: 'Probability',
            icon: 'sigma',
            panel: <Probability match={match} outcomes={outcomes} />,
          },
          {
            id: 'statistics',
            label: 'Statistics',
            icon: 'apiUsage',
            panel: (
              <Card>
                <CardHeader>
                  <CardTitle>Team statistics</CardTitle>
                  <CardDescription>Season to date</CardDescription>
                </CardHeader>
                <CardBody>
                  <StatComparison
                    home={match.home}
                    away={match.away}
                    homeName={match.homeTeam}
                    awayName={match.awayTeam}
                  />
                </CardBody>
              </Card>
            ),
          },
          {
            id: 'monte-carlo',
            label: 'Monte Carlo',
            icon: 'simulation',
            panel: <MonteCarloPanel match={match} />,
          },
          {
            id: 'market',
            label: 'Market',
            icon: 'wallet',
            panel: <Market goalsMarkets={goalsMarkets} outcomes={outcomes} />,
          },
          {
            id: 'ai',
            label: 'AI Analysis',
            icon: 'analyst',
            panel: <AnalysisPanel match={match} />,
          },
        ]}
      />

      <Note className="mt-6">
        Probabilities describe uncertainty, not certainty. A high figure means the model expects that
        outcome more often than the alternatives across comparable fixtures — it says nothing about
        this single match.
      </Note>
    </>
  );
}

/* ------------------------------------------------------------------
   Overview: the whole fixture in one screenful.
   ------------------------------------------------------------------ */

function Overview({ match }: { match: MatchView }) {
  const best = match.topScores[0]?.probability ?? 1;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Model distribution</CardTitle>
          <CardDescription>{match.modelVersion}</CardDescription>
        </CardHeader>
        <CardBody className="space-y-5">
          <ProbabilityBar
            probabilities={match.probabilities}
            size="lg"
            showLabels
            homeLabel={match.homeTeam}
            awayLabel={match.awayTeam}
          />
          <OutcomeDistribution
            probabilities={match.probabilities}
            homeLabel={match.homeTeam}
            awayLabel={match.awayTeam}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model quality</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <ConfidenceScore score={match.confidence} />
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="eyebrow">Risk</span>
            <RiskBadge score={match.risk} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Model</span>
            <span className="tabular font-mono text-small">{match.modelVersion}</span>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Most likely scores</CardTitle>
          <CardDescription>Scaled against the leading scoreline</CardDescription>
        </CardHeader>
        <CardBody className="space-y-2.5">
          {match.topScores.map((score) => (
            <BarRow
              key={`${score.home}-${score.away}`}
              label={`${score.home}–${score.away}`}
              value={score.probability}
              scale={best}
              display={pct(score.probability)}
              tone="info"
            />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goals market</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3.5">
          <ProgressBar label="Over 1.5" value={match.goals.over15} valueLabel={pct(match.goals.over15)} size="sm" />
          <ProgressBar label="Over 2.5" value={match.goals.over25} valueLabel={pct(match.goals.over25)} size="sm" />
          <ProgressBar label="Over 3.5" value={match.goals.over35} valueLabel={pct(match.goals.over35)} size="sm" />
          <ProgressBar label="Both to score" value={match.goals.btts} valueLabel={pct(match.goals.btts)} size="sm" />
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------
   Probability: the model's own reading, at full size.
   ------------------------------------------------------------------ */

interface OutcomeRow {
  key: string;
  label: string;
  tick: string;
  value: number;
}

function Probability({ match, outcomes }: { match: MatchView; outcomes: OutcomeRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Model probability</CardTitle>
          <CardDescription>Fair odds shown for reference</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
          {outcomes.map((outcome) => {
            const odds = impliedOdds(outcome.value);
            return (
              <div key={outcome.key} className="bg-surface px-4 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-small text-alpha">{outcome.tick}</span>
                  <span className="min-w-0 truncate text-small text-muted">{outcome.label}</span>
                </div>
                <p className="tabular mt-2 font-mono text-data">{pct(outcome.value)}</p>
                <p className="tabular mt-1 font-mono text-fine text-muted">
                  fair {odds ? odds.toFixed(2) : '—'}
                </p>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading it</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <ConfidenceScore score={match.confidence} />
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <span className="eyebrow">Risk</span>
            <RiskBadge score={match.risk} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Model version</span>
            <span className="tabular font-mono text-small">{match.modelVersion}</span>
          </div>
          <p className="border-t border-line pt-4 text-fine leading-relaxed text-muted">
            Confidence and risk answer different questions. Confidence is how much evidence sits
            behind the estimate; risk is how widely the simulated outcomes spread. A fixture can be
            confidently unpredictable.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------
   Monte Carlo and AI: this screen states what exists and hands over to
   the tool that produces it, rather than showing a placeholder chart.
   ------------------------------------------------------------------ */

function MonteCarloPanel({ match }: { match: MatchView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monte Carlo</CardTitle>
        <CardDescription>Run on demand</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="max-w-2xl text-small text-muted">
          Simulations are not stored against a fixture — they are run when you ask for them, so the
          path count and scenario are yours to choose. The lab opens with this fixture selected.
        </p>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Figure label="Model distribution" value={pct(match.probabilities.home, 0)} hint="Home win" />
          <Figure label="Risk" value={`${Math.round(match.risk * 100)}`} hint="Outcome dispersion" />
          <Figure label="Confidence" value={`${Math.round(match.confidence * 100)}`} hint="Out of 100" />
        </dl>
        <ButtonLink href={`/monte-carlo?match=${match.id}`} icon="simulation">
          Open the simulation lab
        </ButtonLink>
      </CardBody>
    </Card>
  );
}

function AnalysisPanel({ match }: { match: MatchView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI analysis</CardTitle>
        <CardDescription>Explanation, not prediction</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="max-w-2xl text-small text-muted">
          The analyst explains the figures on this page and nothing else. It has no access to news,
          team announcements or market prices, and it produces no numbers of its own — so there is
          no stored write-up here to read, only a conversation to start.
        </p>
        <div className="rounded-lg border border-line bg-raised/40 px-4 py-3">
          <p className="eyebrow">Context it will be given</p>
          <p className="mt-1.5 font-mono text-fine leading-relaxed text-muted">
            {match.homeTeam} vs {match.awayTeam} · 1X2 distribution · goals market · top scorelines ·
            confidence {Math.round(match.confidence * 100)} · risk {Math.round(match.risk * 100)} ·{' '}
            {match.modelVersion}
          </p>
        </div>
        <ButtonLink href={`/ai-analyst?match=${match.id}`} icon="analyst">
          Ask the analyst
        </ButtonLink>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------
   Market. The sample dataset carries no bookmaker prices, so the panel
   shows the model's own fair prices and says what is missing.
   ------------------------------------------------------------------ */

function Market({
  goalsMarkets,
  outcomes,
}: {
  goalsMarkets: Array<{ label: string; value: number }>;
  outcomes: OutcomeRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Fair prices</CardTitle>
          <CardDescription>Implied by the model</CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          {outcomes.map((outcome) => {
            const odds = impliedOdds(outcome.value);
            return (
              <div key={outcome.key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-small text-muted">
                  <span className="pr-2 font-mono text-alpha">{outcome.tick}</span>
                  {outcome.label}
                </span>
                <span className="tabular shrink-0 font-mono text-small">
                  {odds ? odds.toFixed(2) : '—'}
                </span>
              </div>
            );
          })}
          <p className="border-t border-line pt-3 text-fine leading-relaxed text-muted">
            A fair price is the model probability inverted, with no margin added. Compare it with a
            bookmaker&rsquo;s price to see which side of the market the model sits on.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goals market</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3.5">
          {goalsMarkets.map((market) => (
            <ProgressBar
              key={market.label}
              label={market.label}
              value={market.value}
              valueLabel={`${pct(market.value)} · ${impliedOdds(market.value)?.toFixed(2) ?? '—'}`}
              size="sm"
            />
          ))}
        </CardBody>
      </Card>

      <Card variant="warning" className="lg:col-span-2">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-h3 font-semibold">No captured prices</p>
            <p className="mt-1 text-small text-muted">
              This fixture is from the sample dataset, which carries no bookmaker snapshots. Value
              against the market can only be computed where real prices have been stored.
            </p>
          </div>
          <Badge variant="premium">Demo data</Badge>
        </CardBody>
      </Card>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-line bg-raised/40 px-3 py-2.5">
      <dt className="eyebrow truncate">{label}</dt>
      <dd className="tabular mt-1 font-mono text-data-sm">{value}</dd>
      <dd className="mt-0.5 text-fine text-muted">{hint}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------
   Statistics.
   ------------------------------------------------------------------ */

const ROWS: Array<{ key: keyof TeamStats; label: string; format: (v: number) => string }> = [
  { key: 'form',        label: 'Recent form',      format: (v) => pct(v, 0) },
  { key: 'xgFor',       label: 'Expected goals for',    format: (v) => v.toFixed(2) },
  { key: 'xgAgainst',   label: 'Expected goals against', format: (v) => v.toFixed(2) },
  { key: 'elo',         label: 'Elo rating',       format: (v) => v.toFixed(0) },
  { key: 'goalsFor',    label: 'Goals scored',     format: (v) => v.toFixed(0) },
  { key: 'goalsAgainst',label: 'Goals conceded',   format: (v) => v.toFixed(0) },
];

/**
 * A three-column comparison rather than a data table: the metric name sits
 * between the two figures so the eye reads across a single row, and the
 * leading side is the only thing coloured.
 */
function StatComparison({
  home,
  away,
  homeName,
  awayName,
}: {
  home: TeamStats;
  away: TeamStats;
  homeName: string;
  awayName: string;
}) {
  return (
    <table className="w-full text-small">
      <caption className="sr-only">
        {homeName} compared with {awayName}, season to date
      </caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className="eyebrow pb-2 text-left font-normal">{homeName}</th>
          <th scope="col" className="eyebrow pb-2 text-center font-normal">Metric</th>
          <th scope="col" className="eyebrow pb-2 text-right font-normal">{awayName}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {ROWS.map((row) => {
          const h = home[row.key];
          const a = away[row.key];
          // Fewer goals conceded is better, so that row inverts.
          const lowerIsBetter = row.key === 'xgAgainst' || row.key === 'goalsAgainst';
          const homeLeads = lowerIsBetter ? h < a : h > a;
          return (
            <tr key={row.key}>
              <td className={`tabular py-2.5 font-mono ${homeLeads ? 'text-alpha' : 'text-ink'}`}>
                {row.format(h)}
              </td>
              <td className="py-2.5 text-center text-fine text-muted">{row.label}</td>
              <td className={`tabular py-2.5 text-right font-mono ${homeLeads ? 'text-ink' : 'text-alpha'}`}>
                {row.format(a)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
