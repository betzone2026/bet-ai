'use client';

import { useEffect, useRef, useState } from 'react';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { pct } from '@/lib/utils';

/**
 * A live Monte Carlo convergence, running in the hero.
 *
 * Rather than illustrating the product with a screenshot, the page opens
 * by doing the thing the product does: paths accumulate, the estimate
 * settles, and the interval around it narrows. It is the clearest
 * possible statement that this is an uncertainty tool — the number moves,
 * and then stops moving, in front of the reader.
 */

const LAMBDA_HOME = 1.62;
const LAMBDA_AWAY = 1.08;
const TARGET_PATHS = 40_000;
const BATCH = 400;

function poisson(lambda: number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > limit);
  return k - 1;
}

export function ConvergenceHero() {
  const [paths, setPaths] = useState(0);
  const [counts, setCounts] = useState({ home: 0, draw: 0, away: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tally = { home: 0, draw: 0, away: 0 };
    let total = 0;

    const step = () => {
      const size = reduced ? TARGET_PATHS : BATCH;
      for (let i = 0; i < size && total < TARGET_PATHS; i += 1) {
        const h = poisson(LAMBDA_HOME);
        const a = poisson(LAMBDA_AWAY);
        if (h > a) tally.home += 1;
        else if (h === a) tally.draw += 1;
        else tally.away += 1;
        total += 1;
      }
      setCounts({ ...tally });
      setPaths(total);
      if (total < TARGET_PATHS) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const n = Math.max(paths, 1);
  const probabilities = {
    home: counts.home / n,
    draw: counts.draw / n,
    away: counts.away / n,
  };

  // Standard error on the leading estimate, shown shrinking as n grows.
  const se = Math.sqrt(Math.max(probabilities.home * (1 - probabilities.home), 1e-9) / n);
  const settled = paths >= TARGET_PATHS;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 hairline-top sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live simulation</p>
          <p className="mt-1.5 font-display text-body font-semibold">Arsenal vs Brighton</p>
          <p className="text-fine text-muted">Premier League &middot; sample fixture</p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Paths</p>
          <p className="tabular mt-1.5 font-mono text-data-sm text-alpha">
            {paths.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProbabilityBar
          probabilities={probabilities}
          size="lg"
          showLabels
          homeLabel="Arsenal"
          awayLabel="Brighton"
        />
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="bg-surface px-3 py-3">
          <dt className="eyebrow">Std. error</dt>
          <dd className="tabular mt-1 font-mono text-body">±{(se * 100).toFixed(2)}</dd>
        </div>
        <div className="bg-surface px-3 py-3">
          <dt className="eyebrow">Home win</dt>
          <dd className="tabular mt-1 font-mono text-body text-alpha">{pct(probabilities.home)}</dd>
        </div>
        <div className="bg-surface px-3 py-3">
          <dt className="eyebrow">State</dt>
          <dd className="mt-1 font-mono text-body">
            {settled ? (
              <span className="text-up">converged</span>
            ) : (
              <span className="text-muted">running</span>
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-fine leading-relaxed text-muted">
        Illustrative simulation running in your browser on sample inputs. It shows how an
        estimate stabilises as paths accumulate — it is not a forecast of a real fixture.
      </p>
    </div>
  );
}
