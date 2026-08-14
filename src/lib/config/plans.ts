/**
 * Single source of truth for plan tiers, prices and feature limits.
 * Nothing in the UI or API routes may hard-code
 * a limit: everything reads from PLANS. The Python backend mirrors this
 * file in `backend/app/core/limits.py` — keep the two in sync.
 */

export const PLAN_IDS = ['free', 'pro', 'advanced', 'quant'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Sentinel for "no cap". Compare with `isUnlimited()`, never with `-1`. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

export function isUnlimited(value: number): boolean {
  return !Number.isFinite(value);
}

export interface PlanLimits {
  /** Full match analyses openable per UTC day. */
  maxDailyAnalysis: number;
  /** Largest simulation count accepted by the Monte Carlo engine. */
  monteCarloLimit: number;
  /** Questions to the AI Analyst per UTC day. */
  aiQueriesDaily: number;
  /** Monte Carlo runs per UTC day. */
  monteCarloRunsDaily: number;
  /** REST API access to the quantitative endpoints. */
  apiAccess: boolean;
  /** Portfolio and risk-allocation tooling. */
  portfolioTools: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in euro cents; keeps arithmetic away from floats. */
  priceCents: number;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  /** Set in the environment, never committed. */
  stripePriceEnvKey: string | null;
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    tagline: 'See how the models think before you commit.',
    features: [
      'A limited set of matches each day',
      'Baseline 1X2 probabilities',
      '10,000-path Monte Carlo runs',
      '3 AI Analyst questions per day',
    ],
    limits: {
      maxDailyAnalysis: 3,
      monteCarloLimit: 10_000,
      aiQueriesDaily: 3,
      monteCarloRunsDaily: 5,
      apiAccess: false,
      portfolioTools: false,
    },
    stripePriceEnvKey: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 2990,
    tagline: 'The full model output on every fixture you follow.',
    features: [
      'Every match, fully analysed',
      '50,000-path Monte Carlo runs',
      'AI Analyst with quantitative context',
      'Market comparison and edge estimates',
      'Extended team statistics',
    ],
    limits: {
      maxDailyAnalysis: 30,
      monteCarloLimit: 50_000,
      aiQueriesDaily: 50,
      monteCarloRunsDaily: 50,
      apiAccess: false,
      portfolioTools: false,
    },
    stripePriceEnvKey: 'STRIPE_PRICE_PRO',
    highlighted: true,
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    priceCents: 6990,
    tagline: 'Risk tooling for people running a book of positions.',
    features: [
      '100,000-path Monte Carlo runs',
      'Ensemble probability models',
      'Portfolio and exposure tracking',
      'Risk decomposition per position',
      'Full historical model archive',
    ],
    limits: {
      maxDailyAnalysis: 100,
      monteCarloLimit: 100_000,
      aiQueriesDaily: 200,
      monteCarloRunsDaily: 200,
      apiAccess: false,
      portfolioTools: true,
    },
    stripePriceEnvKey: 'STRIPE_PRICE_ADVANCED',
  },
  quant: {
    id: 'quant',
    name: 'Quant',
    priceCents: 14990,
    tagline: 'Raw access to the engine, on your own infrastructure.',
    features: [
      '500,000-path Monte Carlo runs',
      'REST API access',
      'Custom model parameters',
      'Priority queue for simulations',
      'Unlimited analyses and AI queries',
    ],
    limits: {
      maxDailyAnalysis: UNLIMITED,
      monteCarloLimit: 500_000,
      aiQueriesDaily: UNLIMITED,
      monteCarloRunsDaily: UNLIMITED,
      apiAccess: true,
      portfolioTools: true,
    },
    stripePriceEnvKey: 'STRIPE_PRICE_QUANT',
  },
};

export const PLAN_LIST: Plan[] = PLAN_IDS.map((id) => PLANS[id]);

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id ?? 'free') as PlanId] ?? PLANS.free;
}

export function limitsFor(id: string | null | undefined): PlanLimits {
  return getPlan(id).limits;
}

/** `true` when the plan still has room for one more use of `feature`. */
export function withinLimit(
  planId: string | null | undefined,
  feature: keyof Pick<PlanLimits, 'maxDailyAnalysis' | 'aiQueriesDaily' | 'monteCarloRunsDaily'>,
  usedToday: number,
): boolean {
  const limit = limitsFor(planId)[feature];
  return isUnlimited(limit) || usedToday < limit;
}

export function formatPrice(priceCents: number): string {
  return priceCents === 0
    ? '€0'
    : `€${(priceCents / 100).toFixed(2).replace('.', ',')}`;
}

export function formatLimit(value: number): string {
  return isUnlimited(value) ? 'Unlimited' : value.toLocaleString('en-US');
}
