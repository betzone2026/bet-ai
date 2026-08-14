import type { MatchView, SimulationResult } from '@/lib/types/domain';

export interface SimulationRequest {
  match: MatchView;
  simulations: number;
  /** Goals-per-match uplift applied to the home side. */
  homeAdvantage?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface SimulationEngine {
  readonly id: 'netlify';
  run(request: SimulationRequest): Promise<SimulationResult>;
}

const netlifyEngine: SimulationEngine = {
  id: 'netlify',
  async run({ match, simulations, homeAdvantage = 0.15, onProgress, signal }) {
    onProgress?.(0.1);
    const response = await fetch('/api/simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, simulations, homeAdvantage }),
      signal,
    });
    const body = (await response.json().catch(() => null)) as (SimulationResult & { error?: string }) | null;
    if (!response.ok || !body) throw new Error(body?.error ?? 'Simulation failed.');
    onProgress?.(1);
    return body;
  },
};

export function getSimulationEngine(): SimulationEngine {
  return netlifyEngine;
}
