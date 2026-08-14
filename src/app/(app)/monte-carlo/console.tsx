'use client';

import { useMemo, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { Badge, DemoBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { getSimulationEngine } from '@/lib/simulation/engine';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';
import { pct } from '@/lib/utils';
import type { SimulationResult } from '@/lib/types/domain';

/** Path counts offered in the selector, capped by the caller's plan. */
const PATH_STEPS = [10_000, 50_000, 100_000, 500_000];

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
        { label: match.homeTeam, value: result.homeWin, interval: result.confidenceInterval.home },
        { label: 'Draw', value: result.draw, interval: result.confidenceInterval.draw },
        { label: match.awayTeam, value: result.awayWin, interval: result.confidenceInterval.away },
      ].sort((a, b) => b.value - a.value)[0]
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr] lg:items-start">
      {/* Controls ---------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation engine</CardTitle>
          <Badge>demo</Badge>
        </CardHeader>
        <CardBody className="space-y-5">
          <label className="block">
            <span className="eyebrow">Match</span>
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              disabled={running}
              className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base px-3 text-sm text-ink focus:border-alpha focus:outline-none"
            >
              {DEMO_MATCHES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.homeTeam} vs {m.awayTeam}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Number of simulations</span>
              <span className="tabular font-mono text-xs text-alpha">
                {paths.toLocaleString('en-US')}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PATH_STEPS.map((step) => {
                const locked = step > cap;
                return (
                  <button
                    key={step}
                    type="button"
                    disabled={locked || running}
                    onClick={() => setPaths(step)}
                    title={locked ? `Available on higher plans` : undefined}
                    className={
                      step === paths
                        ? 'rounded-lg border border-alpha/50 bg-alpha/10 py-2 font-mono text-xs text-alpha'
                        : 'rounded-lg border border-line bg-base py-2 font-mono text-xs text-muted enabled:hover:text-ink disabled:opacity-35'
                    }
                  >
                    {step.toLocaleString('en-US')}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {planConfig.name} plan · up to {formatLimit(cap)} paths per run
            </p>
          </div>

          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Home advantage</span>
              <span className="tabular font-mono text-xs">{homeAdvantage.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={homeAdvantage}
              disabled={running}
              onChange={(e) => setHomeAdvantage(Number(e.target.value))}
              className="mt-3 w-full accent-alpha"
            />
            <span className="mt-1.5 block text-[11px] text-muted">
              Goals per match added to the home side&apos;s scoring rate.
            </span>
          </label>

          {running ? (
            <Button variant="secondary" className="w-full" onClick={stop}>
              <Square className="h-3.5 w-3.5" aria-hidden />
              Stop simulation
            </Button>
          ) : (
            <Button className="w-full" onClick={run}>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Run simulation
            </Button>
          )}

          {running && (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Progress</span>
                <span className="tabular font-mono text-xs">{Math.round(progress * 100)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-raised">
                <div
                  className="h-full bg-alpha transition-[width] duration-150"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Results ------------------------------------------------------ */}
      <div className="space-y-5">
        {error && <ErrorState description={error} onRetry={run} />}

        {!result && !error && (
          <EmptyState
            title="No simulation yet"
            description="Choose a fixture and a path count, then run the engine to see the full distribution of outcomes."
          />
        )}

        {result && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {match.homeTeam} vs {match.awayTeam}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <DemoBadge />
                  <Badge>{result.executionTimeMs} ms</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <p className="eyebrow">Most probable outcome</p>
                <p className="mt-2 font-display text-xl font-semibold">
                  {leading?.label}{' '}
                  <span className="tabular font-mono text-alpha">{pct(leading?.value ?? 0)}</span>
                </p>

                <div className="mt-6">
                  <ProbabilityBar
                    probabilities={{ home: result.homeWin, draw: result.draw, away: result.awayWin }}
                    size="lg"
                    showLabels
                    homeLabel={match.homeTeam}
                    awayLabel={match.awayTeam}
                  />
                </div>

                <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                  {[
                    { label: `${match.homeTeam} win`, interval: result.confidenceInterval.home },
                    { label: 'Draw', interval: result.confidenceInterval.draw },
                    { label: `${match.awayTeam} win`, interval: result.confidenceInterval.away },
                  ].map((row) => (
                    <div key={row.label} className="bg-surface px-4 py-3">
                      <p className="eyebrow truncate">{row.label} · 95% CI</p>
                      <p className="tabular mt-1.5 font-mono text-sm">
                        {pct(row.interval[0])} – {pct(row.interval[1])}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-muted">
                  The interval covers sampling error inside the model only. It does not account for
                  the possibility that the model itself is wrong.
                </p>
              </CardBody>
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Goals markets</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                  {[
                    { label: 'Over 2.5 goals', value: result.over25 },
                    { label: 'Under 2.5 goals', value: result.under25 },
                    { label: 'Both teams to score', value: result.btts },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted">{row.label}</span>
                        <span className="tabular font-mono text-sm">{pct(row.value)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-raised">
                        <div className="h-full bg-data" style={{ width: `${row.value * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score distribution</CardTitle>
                  <span className="eyebrow">{result.simulations.toLocaleString('en-US')} paths</span>
                </CardHeader>
                <CardBody className="space-y-2.5">
                  {distribution.map(([score, probability]) => (
                    <div key={score} className="flex items-center gap-3">
                      <span className="tabular w-12 font-mono text-sm">{score.replace('-', '–')}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-raised">
                        <div
                          className="h-full bg-alpha"
                          style={{ width: `${(probability / (distribution[0]?.[1] ?? 1)) * 100}%` }}
                        />
                      </div>
                      <span className="tabular w-12 text-right font-mono text-xs text-muted">
                        {pct(probability)}
                      </span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
