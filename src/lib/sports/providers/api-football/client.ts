/**
 * HTTP client for API-Football v3.
 *
 * Responsibilities stop at the transport: authenticate, time out, classify
 * failures, count requests. It knows nothing about SportAlpha's models — the
 * mapper does that — and it touches no database, which is what makes it
 * directly testable with an injected `fetch`.
 *
 * The API key is read from `process.env.API_FOOTBALL_KEY` at construction and
 * never leaves this module: it is not returned, not logged, and not included in
 * any error message. Errors carry the endpoint and status instead, which is
 * what an operator actually needs.
 */

import { serverEnv } from '../../../env.ts';
import { PROVIDER_TIMEOUT_MS } from '../../config.ts';
import { SportsProviderError } from '../../errors.ts';
import { redactValue, sportsLog } from '../../logging.ts';
import type { ApiFootballEnvelope } from './types.ts';

export const API_FOOTBALL_PROVIDER = 'api-football';
const DEFAULT_BASE_URL = 'https://v3.football.api-sports.io';

export interface ApiFootballClientOptions {
  /** Overrides the environment. Used by tests; production leaves it unset. */
  apiKey?: string | null;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Called once per HTTP request so the quota tracker can record it. */
  onRequest?: (endpoint: string) => void;
}

export interface RateLimitSnapshot {
  /** Requests allowed on the current plan, per day. */
  dailyLimit: number | null;
  dailyRemaining: number | null;
  /** Per-minute burst allowance. */
  minuteLimit: number | null;
  minuteRemaining: number | null;
}

/**
 * Reads the key server-side only.
 *
 * The check is not paranoia: `API_FOOTBALL_KEY` has no `NEXT_PUBLIC_` prefix
 * precisely so Next.js cannot inline it into a browser bundle, and this throws
 * loudly if a future refactor ever imports this module from a client component.
 */
function readApiKey(): string | null {
  if (typeof window !== 'undefined') {
    throw new SportsProviderError(
      'MISSING_API_KEY',
      'The sports provider client is server-side only and must not run in the browser.',
      { provider: API_FOOTBALL_PROVIDER },
    );
  }
  const key = serverEnv.apiFootballKey;
  return key ? key : null;
}

export class ApiFootballClient {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly onRequest: ((endpoint: string) => void) | undefined;
  private readonly requestCounts = new Map<string, number>();
  private lastRateLimit: RateLimitSnapshot | null = null;

  constructor(options: ApiFootballClientOptions = {}) {
    this.apiKey = options.apiKey === undefined ? readApiKey() : (options.apiKey?.trim() || null);
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.onRequest = options.onRequest;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  /** Requests made by this instance, per endpoint. */
  usage(): Array<{ endpoint: string; requests: number }> {
    return [...this.requestCounts.entries()].map(([endpoint, requests]) => ({ endpoint, requests }));
  }

  /** What the provider reported about the quota on the most recent response. */
  rateLimit(): RateLimitSnapshot | null {
    return this.lastRateLimit;
  }

  /**
   * Performs one GET and returns the decoded envelope.
   *
   * Every failure path ends in a `SportsProviderError` with a `code` the sync
   * service can branch on, so an exhausted quota is distinguishable from a
   * broken key without reading message text.
   */
  async get<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<ApiFootballEnvelope<T>> {
    if (!this.apiKey) {
      throw new SportsProviderError('MISSING_API_KEY', 'API_FOOTBALL_KEY is not configured.', {
        provider: API_FOOTBALL_PROVIDER,
        endpoint,
      });
    }

    const url = new URL(`${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    this.requestCounts.set(endpoint, (this.requestCounts.get(endpoint) ?? 0) + 1);
    this.onRequest?.(endpoint);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          'x-apisports-key': this.apiKey,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      const aborted = cause instanceof Error && /abort|timeout/i.test(cause.name + cause.message);
      throw new SportsProviderError(
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        aborted
          ? `Request to ${endpoint} exceeded ${this.timeoutMs}ms.`
          : `Request to ${endpoint} failed before a response arrived.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, cause },
      );
    }

    this.lastRateLimit = readRateLimit(response.headers);

    if (!response.ok) {
      throw this.httpError(response, endpoint);
    }

    let envelope: ApiFootballEnvelope<T>;
    try {
      envelope = (await response.json()) as ApiFootballEnvelope<T>;
    } catch (cause) {
      throw new SportsProviderError(
        'INVALID_RESPONSE',
        `${endpoint} returned a body that is not JSON.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, status: response.status, cause },
      );
    }

    const providerError = describeEnvelopeErrors(envelope.errors);
    if (providerError) {
      throw new SportsProviderError(
        classifyProviderError(providerError.fields),
        this.safe(`${endpoint} rejected the request: ${providerError.message}`),
        { provider: API_FOOTBALL_PROVIDER, endpoint, status: response.status },
      );
    }

    if (!Array.isArray(envelope.response)) {
      throw new SportsProviderError(
        'INVALID_RESPONSE',
        `${endpoint} returned an envelope without a response array.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, status: response.status },
      );
    }

    if (this.lastRateLimit?.dailyRemaining !== null && this.lastRateLimit?.dailyRemaining !== undefined) {
      if (this.lastRateLimit.dailyRemaining <= 10) {
        sportsLog.warn('provider daily quota nearly exhausted', {
          endpoint,
          remaining: this.lastRateLimit.dailyRemaining,
        });
      }
    }

    return envelope;
  }

  private httpError(response: Response, endpoint: string): SportsProviderError {
    const retryAfter = Number(response.headers.get('retry-after'));
    const base = {
      provider: API_FOOTBALL_PROVIDER,
      endpoint,
      status: response.status,
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    };

    if (response.status === 429) {
      return new SportsProviderError('RATE_LIMITED', `${endpoint} hit the provider rate limit.`, base);
    }
    if (response.status === 401 || response.status === 403) {
      return new SportsProviderError(
        'AUTH_FAILED',
        `${endpoint} rejected the configured API key.`,
        base,
      );
    }
    return new SportsProviderError(
      'HTTP_ERROR',
      `${endpoint} returned HTTP ${response.status}.`,
      base,
    );
  }

  /** Last line of defence: strip the key from anything echoed by the provider. */
  private safe(message: string): string {
    return redactValue(message, this.apiKey);
  }
}

function readRateLimit(headers: Headers): RateLimitSnapshot {
  const toNumber = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    dailyLimit: toNumber(headers.get('x-ratelimit-requests-limit')),
    dailyRemaining: toNumber(headers.get('x-ratelimit-requests-remaining')),
    minuteLimit: toNumber(headers.get('x-ratelimit-limit')),
    minuteRemaining: toNumber(headers.get('x-ratelimit-remaining')),
  };
}

/**
 * The v3 API answers `200 OK` with a populated `errors` object for application
 * failures — a dead key, an exhausted plan — so a successful HTTP status is not
 * a successful call.
 */
function describeEnvelopeErrors(
  errors: ApiFootballEnvelope<unknown>['errors'],
): { fields: string[]; message: string } | null {
  if (!errors) return null;

  if (Array.isArray(errors)) {
    return errors.length > 0 ? { fields: [], message: errors.join('; ') } : null;
  }

  const entries = Object.entries(errors).filter(([, value]) => value);
  if (entries.length === 0) return null;

  return {
    fields: entries.map(([field]) => field.toLowerCase()),
    message: entries.map(([field, value]) => `${field}: ${value}`).join('; '),
  };
}

function classifyProviderError(fields: string[]) {
  if (fields.some((field) => field === 'token' || field === 'access')) return 'AUTH_FAILED' as const;
  if (fields.some((field) => field === 'requests' || field === 'ratelimit' || field === 'plan')) {
    return 'RATE_LIMITED' as const;
  }
  return 'PROVIDER_ERROR' as const;
}
