'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProbabilityBar, OutcomeDistribution } from '@/components/ui/probability-bar';
import { ProgressBar, BarRow } from '@/components/ui/progress';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState, Note } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { AppIcon } from '@/components/ui/icon';
import { TeamCrest } from '@/components/app/team-crest';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { getSimulationEngine } from '@/lib/simulation/engine';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';
import { cn, pct } from '@/lib/utils';
import type { SimulationResult } from '@/lib/types/domain';

/** Path counts offered in the selector, capped by the caller's plan. */
const PATH_STEPS = [10_000, 50_000, 100_000, 500_000];

/**
 * Named settings for the one model input this screen exposes. The slider
 * under Advanced still writes the same value — the presets exist so the
 * common cases have names instead of numbers.
 */
const SCENARIOS = [
  { id: 'neutral', label: 'Neutral venue', homeAdvantage: 0, hint: 'No home uplift applied' },
  { id: 'baseline', label: 'Baseline', homeAdvantage: 0.15, hint: 'The model default' },
  { id: 'strong', label: 'Strong home', homeAdvantage: 0.3, hint: 'Marked home advantage' },
] as const;

/** The grid the heatmap draws. Higher scorelines are vanishingly rare and
    would spend most of the cells on empty space. */
const GOAL_RANGE = [0, 1, 2, 3, 4];

export function MonteCarloConsole({
  plan,
  initialMatchId,
}: {
  plan: PlanId;
  initialMatchId?: string;
}) {
  const toast = useToast();
  const planConfig = getPlan(plan);
  const cap = planConfig.limits.monteCarloLimit;

  const allowedSteps = PATH_STEPS.filter((n) => n <= cap);
  const [matchId, setMatchId] = useState(initialMatchId ?? DEMO_MATCHES[0]!.id);
  const [paths, setPaths] = useState(allowedSteps[allowedSteps.length - 1] ?? 10_000);
  const [homeAdvantage, setHomeAdvantage] = useState(0.15);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const match = useMemo(
    () => DEMO_MATCHES.find((m) => m.id === matchId) ?? DEMO_MATCHES[0]!,
    [matchId],
  );

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const engine = getSimulationEngine();
      const output = await engine.run({
        match,
        simulations: paths,
        homeAdvantage,
        onProgress: setProgress,
        signal: controller.signal,
      });
      setResult(output);
      toast.show(`Simulation finished in ${output.executionTimeMs} ms.`, 'success');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        toast.show('Simulation stopped.');
      } else {
        setError('The simulation could not complete. Reduce the number of paths and try again.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const distribution = result
    ? Object.entries(result.scoreDistribution).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : [];

  const leading = result
    ? [
        { label: match.homeTeam, value: result.homeWin },
        { label: 'Draw', value: result.draw },
        { label: match.awayTeam, value: result.awayWin },
      ].sort((a, b) => b.value - a.value)[0]
    : null;

  const scenario = SCENARIOS.find((option) => option.homeAdvantage === homeAdvantage);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      {/* ---- Controls ------------------------------------------------ */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Run configuration</CardTitle>
          <DemoBadge />
        </CardHeader>

        <CardBody className="space-y-5">
          <label className="block">
            <span className="eyebrow">Match</span>
            <select
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
              disabled={running}
              className="mt-1.5 min-h-touch w-full rounded-lg border border-line bg-base px-3 text-small text-ink focus:border-alpha disabled:opacity-50 sm:min-h-0 sm:h-10"
            >
              {DEMO_MATCHES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.homeTeam} vs {option.awayTeam}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/40 px-3 py-2">
            <TeamCrest name={match.homeTeam} size={20} />
            <span className="min-w-0 flex-1 truncate font-mono text-fine text-muted">
              {match.league}
            </span>
            <Badge variant="info">{match.modelVersion}</Badge>
          </div>

          {/* Simulations ------------------------------------------- */}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">Simulations</span>
              <span className="tabular font-mono text-small text-alpha">
                {paths.toLocaleString('en-US')}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PATH_STEPS.map((step) => {
                const locked = step > cap;
                const selected = step === paths;
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={locked || running}
                    onClick={() => setPaths(step)}
                    aria-pressed={selected}
                    title={locked ? 'Available on a higher plan' : undefined}
                    className={cn(
                      'tabular min-h-touch rounded-lg border font-mono text-small',
                      'transition-colors duration-fast sm:min-h-0 sm:h-9',
                      selected
                        ? 'border-alpha/50 bg-alpha/10 text-alpha'
                        : 'border-line bg-base text-muted enabled:hover:border-line-active enabled:hover:text-ink',
                      locked && 'opacity-35',
                    )}
                  >
                    {step.toLocaleString('en-US')}
                    {locked && <AppIcon name="shield" size={16} className="ml-1.5 h-3 w-3" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-fine text-muted">
              {planConfig.name} plan · up to {formatLimit(cap)} paths per run
            </p>
          </div>

          {/* Scenario ---------------------------------------------- */}
          <div>
            <span className="eyebrow">Scenario</span>
            <div className="mt-2 space-y-1.5">
              {SCENARIOS.map((option) => {
                const selected = option.homeAdvantage === homeAdvantage;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={running}
                    onClick={() => setHomeAdvantage(option.homeAdvantage)}
                    aria-pressed={selected}
                    className={cn(
                      'flex w-full min-h-touch items-center gap-2 rounded-lg border px-3 text-left',
                      'transition-colors duration-fast sm:min-h-0 sm:h-10',
                      selected
                        ? 'border-alpha/45 bg-alpha/10'
                        : 'border-line bg-base hover:border-line-active',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-small', selected ? 'text-alpha' : 'text-ink')}>
                        {option.label}
                      </span>
                      <span className="block truncate text-micro text-muted">{option.hint}</span>
                    </span>
                    <span className="tabular shrink-0 font-mono text-fine text-muted">
                      +{option.homeAdvantage.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced ---------------------------------------------- */}
          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between gap-2 text-small text-muted transition-colors duration-fast hover:text-ink"
            >
              <span className="inline-flex items-center gap-2">
                <AppIcon name="tune" size={16} />
                Advanced
              </span>
              <AppIcon
                name="chevronDown"
                size={16}
                className={cn('transition-transform duration-fast', advancedOpen && 'rotate-180')}
              />
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="eyebrow">Home advantage</span>
                    <span className="tabular font-mono text-small">{homeAdvantage.toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={homeAdvantage}
                    disabled={running}
                    onChange={(event) => setHomeAdvantage(Number(event.target.value))}
                    className="mt-3 w-full accent-alpha"
                  />
                  <span className="mt-1.5 block text-fine leading-relaxed text-muted">
                    Goals per match added to the home side&apos;s scoring rate. The scenario buttons
                    above set the same value.
                  </span>
                </label>

                <p className="text-fine leading-relaxed text-muted">
                  Runs are not seeded, so two runs of the same configuration differ by sampling
                  error. Raise the path count to narrow the intervals.
                </p>
              </div>
            )}
          </div>

          {/* Action ------------------------------------------------- */}
          {running ? (
            <Button variant="secondary" icon="stop" className="w-full" onClick={stop}>
              Stop simulation
            </Button>
          ) : (
            <Button icon="run" size="lg" className="w-full" onClick={run}>
              Run simulation
            </Button>
          )}

          {running && (
            <ProgressBar
              label="Progress"
              value={progress}
              valueLabel={`${Math.round(progress * 100)}%`}
              size="sm"
            />
          )}
        </CardBody>
      </Card>

      {/* ---- Results ------------------------------------------------- */}
      <div className="space-y-4">
        {error && <ErrorState description={error} onRetry={run} />}

        {!result && !error && !running && (
          <EmptyState
            icon="simulation"
            title="No simulation yet."
            description="Choose a fixture, a path count and a scenario, then run the engine to see the full distribution of outcomes."
          />
        )}

        {running && !result && (
          <Card>
            <CardBody className="py-14 text-center">
              <AppIcon name="spinner" size={24} className="mx-auto animate-spin text-alpha" />
              <p className="mt-4 font-display text-h3 font-semibold">
                Simulating {paths.toLocaleString('en-US')} paths
              </p>
              <p className="mt-1.5 text-small text-muted">
                {match.homeTeam} vs {match.awayTeam} · {scenario?.label ?? 'Custom scenario'}
              </p>
            </CardBody>
          </Card>
        )}

        {result && (
          <>
            {/* Run summary ---------------------------------------- */}
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle className="truncate">
                    {match.homeTeam} vs {match.awayTeam}
                  </CardTitle>
                  <CardDescription>
                    {result.simulations.toLocaleString('en-US')} paths ·{' '}
                    {scenario?.label ?? `home +${homeAdvantage.toFixed(2)}`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DemoBadge />
                  <Badge variant="info">{result.executionTimeMs} ms</Badge>
                </div>
              </CardHeader>

              <CardBody className="space-y-5">
                <div>
                  <p className="eyebrow">Most probable outcome</p>
                  <p className="mt-1.5 font-display text-h1 font-semibold">
                    {leading?.label}
                    <span className="tabular pl-2 font-mono text-alpha">
                      {pct(leading?.value ?? 0)}
                    </span>
                  </p>
                </div>

                <ProbabilityBar
                  probabilities={{ home: result.homeWin, draw: result.draw, away: result.awayWin }}
                  size="lg"
                  showLabels
                  homeLabel={match.homeTeam}
                  awayLabel={match.awayTeam}
                />

                <OutcomeDistribution
                  probabilities={{ home: result.homeWin, draw: result.draw, away: result.awayWin }}
                  homeLabel={match.homeTeam}
                  awayLabel={match.awayTeam}
                />
              </CardBody>
            </Card>

            {/* Confidence intervals -------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Confidence intervals</CardTitle>
                <CardDescription>95%, from sampling error alone</CardDescription>
              </CardHeader>
              <CardBody className="space-y-3.5">
                {[
                  { label: `${match.homeTeam} win`, value: result.homeWin, interval: result.confidenceInterval.home },
                  { label: 'Draw', value: result.draw, interval: result.confidenceInterval.draw },
                  { label: `${match.awayTeam} win`, value: result.awayWin, interval: result.confidenceInterval.away },
                ].map((row) => (
                  <IntervalRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    interval={row.interval}
                  />
                ))}
                <p className="border-t border-line pt-3 text-fine leading-relaxed text-muted">
                  The interval covers sampling error inside the model only. It does not account for
                  the possibility that the model itself is wrong.
                </p>
              </CardBody>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* Goals markets ----------------------------------- */}
              <Card>
                <CardHeader>
                  <CardTitle>Goals markets</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3.5">
                  <ProgressBar label="Over 2.5 goals" value={result.over25} valueLabel={pct(result.over25)} tone="info" size="sm" />
                  <ProgressBar label="Under 2.5 goals" value={result.under25} valueLabel={pct(result.under25)} tone="info" size="sm" />
                  <ProgressBar label="Both teams to score" value={result.btts} valueLabel={pct(result.btts)} tone="info" size="sm" />
                </CardBody>
              </Card>

              {/* Score distribution ------------------------------ */}
              <Card>
                <CardHeader>
                  <CardTitle>Score distribution</CardTitle>
                  <CardDescription>Most frequent scorelines</CardDescription>
                </CardHeader>
                <CardBody className="space-y-2.5">
                  {distribution.map(([score, probability]) => (
                    <BarRow
                      key={score}
                      label={score.replace('-', '–')}
                      value={probability}
                      scale={distribution[0]?.[1] ?? 1}
                      display={pct(probability)}
                    />
                  ))}
                </CardBody>
              </Card>
            </div>

            {/* Heatmap -------------------------------------------- */}
            <Card>
              <CardHeader>
                <CardTitle>Score heatmap</CardTitle>
                <CardDescription>Home goals by row, away by column · % of paths</CardDescription>
              </CardHeader>
              <CardBody>
                <Heatmap
                  scores={result.scoreDistribution}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                />
              </CardBody>
            </Card>

            <Note>
              The engine returns the twelve most frequent scorelines, so cells outside that set are
              left blank rather than filled with a rounded-down figure.
            </Note>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   An interval drawn on its own axis: the point estimate as a mark, the
   interval as a span. Numbers are given as well, because a reader
   comparing two runs needs the digits.
   ------------------------------------------------------------------ */

function IntervalRow({
  label,
  value,
  interval,
}: {
  label: string;
  value: number;
  interval: [number, number];
}) {
  const [low, high] = interval;
  const span = Math.max(high - low, 0.001);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow min-w-0 truncate">{label}</span>
        <span className="tabular shrink-0 font-mono text-small">
          {pct(low)} – {pct(high)}
        </span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-sm bg-raised">
        <div
          className="absolute inset-y-0 bg-info/40"
          style={{ left: `${low * 100}%`, width: `${span * 100}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-alpha"
          style={{ left: `${Math.min(value * 100, 99.8)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   The heatmap. Opacity carries probability against the modal scoreline,
   which keeps the map readable whether the fixture is tight or lopsided.
   Every cell is also a figure on hover and in its accessible name, so the
   colour is never the only channel.
   ------------------------------------------------------------------ */

function Heatmap({
  scores,
  homeTeam,
  awayTeam,
}: {
  scores: Record<string, number>;
  homeTeam: string;
  awayTeam: string;
}) {
  const peak = Math.max(...Object.values(scores), 0.0001);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-separate border-spacing-1">
        <caption className="sr-only">
          Simulated scorelines: {homeTeam} goals by row, {awayTeam} goals by column
        </caption>
        <thead>
          <tr>
            <th scope="col" className="eyebrow w-10 pb-1 text-left font-normal">
              H / A
            </th>
            {GOAL_RANGE.map((away) => (
              <th key={away} scope="col" className="eyebrow pb-1 text-center font-normal">
                {away}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GOAL_RANGE.map((home) => (
            <tr key={home}>
              <th scope="row" className="eyebrow w-10 text-left font-normal">
                {home}
              </th>
              {GOAL_RANGE.map((away) => {
                const probability = scores[`${home}-${away}`];
                if (probability === undefined) {
                  return (
                    <td
                      key={away}
                      className="rounded-md border border-dashed border-line/70 py-2.5 text-center font-mono text-micro text-muted/50"
                    >
                      ·
                    </td>
                  );
                }
                return (
                  <td
                    key={away}
                    className="tabular rounded-md border border-line py-2.5 text-center font-mono text-fine text-ink"
                    style={{
                      backgroundColor: `rgb(var(--c-alpha) / ${Math.max(
                        (probability / peak) * 0.55,
                        0.06,
                      ).toFixed(3)})`,
                    }}
                    title={`${home}–${away} · ${pct(probability)} of simulated paths`}
                  >
                    {(probability * 100).toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
