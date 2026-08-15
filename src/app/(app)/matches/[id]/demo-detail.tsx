/**
 * The demo fixture screen: the full modelled layout, driven by the sample
 * dataset. It is shown only when no real fixture matches the id, and every
 * figure on it carries the demo badge.
 *
 * Kept verbatim from Phase A so the two modes can be compared side by side —
 * the real screen below it shows what an imported fixture actually contains,
 * which is a good deal less.
 */
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { RiskPill, DemoBadge, Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { formatMatchDate, pct, impliedOdds } from '@/lib/utils';
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
      <Link href="/matches" className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All matches
      </Link>

      {/* Fixture header ------------------------------------------------ */}
      <header className="rounded-2xl border border-line bg-surface p-5 hairline-top sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{match.league}</Badge>
          <Badge>{match.country}</Badge>
          {match.demo && <DemoBadge />}
        </div>

        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {match.homeTeam}
          <span className="px-2 font-normal text-muted">vs</span>
          {match.awayTeam}
        </h1>
        <p className="mt-1.5 font-mono text-xs text-muted">{formatMatchDate(match.kickoff)}</p>

        <div className="mt-6">
          <ProbabilityBar
            probabilities={match.probabilities}
            size="lg"
            showLabels
            homeLabel={match.homeTeam}
            awayLabel={match.awayTeam}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-6 border-t border-line pt-5">
          <ConfidenceMeter score={match.confidence} className="w-44" />
          <div>
            <p className="eyebrow">Risk</p>
            <div className="mt-1.5">
              <RiskPill score={match.risk} />
            </div>
          </div>
          <div>
            <p className="eyebrow">Model</p>
            <p className="mt-1.5 font-mono text-xs">{match.modelVersion}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <ButtonLink href={`/monte-carlo?match=${match.id}`} size="sm" variant="secondary">
              Run simulation
            </ButtonLink>
            <ButtonLink href={`/ai-analyst?match=${match.id}`} size="sm">
              Ask the analyst
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* AI probability -------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Match result</CardTitle>
            <span className="eyebrow">Fair odds shown for reference</span>
          </CardHeader>
          <CardBody className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            {outcomes.map((outcome) => {
              const odds = impliedOdds(outcome.value);
              return (
                <div key={outcome.key} className="bg-surface px-4 py-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-alpha">{outcome.tick}</span>
                    <span className="truncate text-xs text-muted">{outcome.label}</span>
                  </div>
                  <p className="tabular mt-2 font-mono text-2xl">{pct(outcome.value)}</p>
                  <p className="tabular mt-1 font-mono text-[11px] text-muted">
                    fair {odds ? odds.toFixed(2) : '—'}
                  </p>
                </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Most likely scores ---------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Most likely scores</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {match.topScores.map((score) => (
              <div key={`${score.home}-${score.away}`} className="flex items-center gap-3">
                <span className="tabular w-12 font-mono text-sm">
                  {score.home}–{score.away}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-raised">
                  <div
                    className="h-full bg-data"
                    style={{ width: `${(score.probability / match.topScores[0]!.probability) * 100}%` }}
                  />
                </div>
                <span className="tabular w-12 text-right font-mono text-xs text-muted">
                  {pct(score.probability)}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Goals market ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Goals market</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {goalsMarkets.map((market) => (
              <div key={market.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">{market.label}</span>
                  <span className="tabular font-mono text-sm">{pct(market.value)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-raised">
                  <div className="h-full bg-alpha" style={{ width: `${market.value * 100}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Team statistics -------------------------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <span className="eyebrow">Season to date</span>
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
      </div>

      <p className="mt-6 rounded-xl border border-line bg-surface/50 px-4 py-3 text-xs leading-relaxed text-muted">
        Probabilities describe uncertainty, not certainty. A high figure means the model expects
        that outcome more often than the alternatives across comparable fixtures — it says nothing
        about this single match.
      </p>
    </>
  );
}

const ROWS: Array<{ key: keyof TeamStats; label: string; format: (v: number) => string }> = [
  { key: 'form',        label: 'Recent form',      format: (v) => pct(v, 0) },
  { key: 'xgFor',       label: 'Expected goals for',    format: (v) => v.toFixed(2) },
  { key: 'xgAgainst',   label: 'Expected goals against', format: (v) => v.toFixed(2) },
  { key: 'elo',         label: 'Elo rating',       format: (v) => v.toFixed(0) },
  { key: 'goalsFor',    label: 'Goals scored',     format: (v) => v.toFixed(0) },
  { key: 'goalsAgainst',label: 'Goals conceded',   format: (v) => v.toFixed(0) },
];

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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line">
          <th className="eyebrow pb-2 text-left font-normal">{homeName}</th>
          <th className="eyebrow pb-2 text-center font-normal">Metric</th>
          <th className="eyebrow pb-2 text-right font-normal">{awayName}</th>
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
              <td className="py-2.5 text-center text-xs text-muted">{row.label}</td>
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
