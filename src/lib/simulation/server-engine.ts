import type { MatchView, SimulationResult } from '@/lib/types/domain';

const SCORE_CAP = 6;

function seededRandom(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

function interval(probability: number, simulations: number): [number, number] {
  const margin = 1.96 * Math.sqrt((probability * (1 - probability)) / simulations);
  return [Math.max(0, probability - margin), Math.min(1, probability + margin)];
}

export function runServerSimulation(input: {
  match: MatchView;
  simulations: number;
  homeAdvantage: number;
  seed?: number;
}): SimulationResult {
  const started = performance.now();
  const random = seededRandom(input.seed);
  const lambdaHome = Math.max(
    0.15,
    (input.match.home.xgFor + input.match.away.xgAgainst) / 2 + input.homeAdvantage,
  );
  const lambdaAway = Math.max(
    0.15,
    (input.match.away.xgFor + input.match.home.xgAgainst) / 2,
  );

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;
  const scores = new Map<string, number>();

  for (let index = 0; index < input.simulations; index += 1) {
    const homeGoals = poisson(lambdaHome, random);
    const awayGoals = poisson(lambdaAway, random);
    if (homeGoals > awayGoals) homeWin += 1;
    else if (homeGoals === awayGoals) draw += 1;
    else awayWin += 1;
    if (homeGoals + awayGoals > 2) over25 += 1;
    if (homeGoals > 0 && awayGoals > 0) btts += 1;
    const score = `${Math.min(homeGoals, SCORE_CAP)}-${Math.min(awayGoals, SCORE_CAP)}`;
    scores.set(score, (scores.get(score) ?? 0) + 1);
  }

  const total = input.simulations;
  const home = homeWin / total;
  const drawn = draw / total;
  const away = awayWin / total;
  const scoreDistribution = Object.fromEntries(
    [...scores.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([score, count]) => [score, count / total]),
  );

  return {
    simulations: total,
    homeWin: home,
    draw: drawn,
    awayWin: away,
    over25: over25 / total,
    under25: 1 - over25 / total,
    btts: btts / total,
    scoreDistribution,
    confidenceInterval: {
      home: interval(home, total),
      draw: interval(drawn, total),
      away: interval(away, total),
    },
    executionTimeMs: Math.round(performance.now() - started),
    engine: 'netlify-server',
  };
}

