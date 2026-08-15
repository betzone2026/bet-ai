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
 *
 * Quota interpretation lives entirely in `./rate-limit.ts`. This file asks that
 * module the questions and never re-implements the answers, so there is exactly
 * one definition of "rate limited" no matter which endpoint is being called.
 */

import { serverEnv } from '../../../env.ts';
import { PROVIDER_TIMEOUT_MS } from '../../config.ts';
import { SportsProviderError, type SportsErrorCode } from '../../errors.ts';
import { redactValue, sportsLog } from '../../logging.ts';
import {
  LOW_QUOTA_THRESHOLD,
  UNKNOWN_RATE_LIMIT,
  classifyEnvelopeError,
  isActuallyRateLimited,
  parseRateLimitHeaders,
  secondsUntilUtcMidnight,
  type RateLimitSnapshot,
} from './rate-limit.ts';
import type { ApiFootballEnvelope } from './types.ts';

export const API_FOOTBALL_PROVIDER = 'api-football';
const DEFAULT_BASE_URL = 'https://v3.football.api-sports.io';

/** How long a spent per-minute allowance is assumed to stay spent. */
const BURST_WINDOW_MS = 60_000;

export type { RateLimitSnapshot } from './rate-limit.ts';

/**
 * Everything one request revealed, in a form the quota tracker and the admin
 * screen can both consume without knowing anything about HTTP.
 */
export interface QuotaObservation {
  endpoint: string;
  status: number | null;
  snapshot: RateLimitSnapshot;
  /** `SUCCESS`, or the code the call failed with. */
  outcome: 'SUCCESS' | SportsErrorCode;
  message: string | null;
  /** Entries in the response array, when there was one. */
  resultCount: number | null;
  observedAt: Date;
}

export interface ApiFootballClientOptions {
  /** Overrides the environment. Used by tests; production leaves it unset. */
  apiKey?: string | null;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Called once per HTTP request so the quota tracker can record it. */
  onRequest?: (endpoint: string) => void;
  /** Called after every response, successful or not. */
  onQuota?: (observation: QuotaObservation) => void;
  /**
   * Emits one structured line per response: status, both header pairs, the
   * envelope's `errors` and its result count. On by default — this is the
   * information that was missing when a healthy 200 was being reported as a
   * rate limit — and never includes the key. Tests turn it off for quiet output.
   */
  diagnostics?: boolean;
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
  private readonly onQuota: ((observation: QuotaObservation) => void) | undefined;
  private readonly diagnostics: boolean;
  private readonly requestCounts = new Map<string, number>();
  private lastRateLimit: RateLimitSnapshot | null = null;
  private lastObservation: QuotaObservation | null = null;
  /** UTC day on which the daily allowance was observed at zero. */
  private exhaustedOnUtcDay: string | null = null;
  /** When the per-minute allowance was last observed at zero. */
  private burstExhaustedAt: number | null = null;

  constructor(options: ApiFootballClientOptions = {}) {
    this.apiKey = options.apiKey === undefined ? readApiKey() : (options.apiKey?.trim() || null);
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.onRequest = options.onRequest;
    this.onQuota = options.onQuota;
    this.diagnostics = options.diagnostics ?? true;
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

  /** The most recent response in full, for the admin screen and the quota table. */
  lastResponse(): QuotaObservation | null {
    return this.lastObservation;
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

    this.assertQuotaAvailable(endpoint);

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
      const error = new SportsProviderError(
        aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        aborted
          ? `Request to ${endpoint} exceeded ${this.timeoutMs}ms.`
          : `Request to ${endpoint} failed before a response arrived.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, cause },
      );
      this.observe({
        endpoint,
        status: null,
        snapshot: UNKNOWN_RATE_LIMIT,
        outcome: error.code,
        message: error.message,
        resultCount: null,
      });
      throw error;
    }

    const snapshot = parseRateLimitHeaders(response);
    this.lastRateLimit = snapshot;

    if (!response.ok) {
      const error = this.httpError(response, endpoint, snapshot);
      this.observe({
        endpoint,
        status: response.status,
        snapshot,
        outcome: error.code,
        message: error.message,
        resultCount: null,
      });
      throw error;
    }

    let envelope: ApiFootballEnvelope<T>;
    try {
      envelope = (await response.json()) as ApiFootballEnvelope<T>;
    } catch (cause) {
      const error = new SportsProviderError(
        'INVALID_RESPONSE',
        `${endpoint} returned a body that is not JSON.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, status: response.status, cause },
      );
      this.observe({
        endpoint,
        status: response.status,
        snapshot,
        outcome: error.code,
        message: error.message,
        resultCount: null,
      });
      throw error;
    }

    const providerError = describeEnvelopeErrors(envelope.errors);
    this.logDiagnostics(endpoint, response.status, snapshot, envelope, providerError?.message);

    if (providerError) {
      // The decision that used to be wrong. `errors.plan` is a capability
      // complaint and `errors.requests` is a spent allowance; only the latter,
      // or a counter that actually reads zero, is a rate limit.
      const { code, retryAfterSeconds } = classifyEnvelopeError({
        fields: providerError.fields,
        message: providerError.message,
        status: response.status,
        snapshot,
      });

      const error = new SportsProviderError(
        code,
        this.safe(`${endpoint} rejected the request: ${providerError.message}`),
        {
          provider: API_FOOTBALL_PROVIDER,
          endpoint,
          status: response.status,
          retryAfterSeconds,
        },
      );
      if (code === 'RATE_LIMITED') this.markExhausted(snapshot);
      this.observe({
        endpoint,
        status: response.status,
        snapshot,
        outcome: code,
        message: error.message,
        resultCount: null,
      });
      throw error;
    }

    if (!Array.isArray(envelope.response)) {
      const error = new SportsProviderError(
        'INVALID_RESPONSE',
        `${endpoint} returned an envelope without a response array.`,
        { provider: API_FOOTBALL_PROVIDER, endpoint, status: response.status },
      );
      this.observe({
        endpoint,
        status: response.status,
        snapshot,
        outcome: error.code,
        message: error.message,
        resultCount: null,
      });
      throw error;
    }

    // A successful call that happened to spend the last of the allowance is
    // still a successful call. The counters are remembered so the *next*
    // request can be refused without a round trip, but this response — already
    // paid for — is returned in full. Rejecting it would throw away data the
    // quota has already been charged for, which is exactly the false positive
    // this module was written to end. An empty array is likewise a valid
    // answer: zero fixtures today is a fact, not a failure.
    this.markExhausted(snapshot);
    this.warnOnLowQuota(endpoint, snapshot);
    this.observe({
      endpoint,
      status: response.status,
      snapshot,
      outcome: 'SUCCESS',
      message: null,
      resultCount: envelope.response.length,
    });

    return envelope;
  }

  /**
   * Refuses a request the provider is certain to reject.
   *
   * Only a *measured* zero blocks: an unknown allowance is allowed through,
   * because the request is how it gets measured.
   */
  private assertQuotaAvailable(endpoint: string): void {
    if (this.exhaustedOnUtcDay !== null && this.exhaustedOnUtcDay === utcDay(new Date())) {
      throw new SportsProviderError(
        'RATE_LIMITED',
        `${endpoint} was not attempted: the daily request allowance is spent.`,
        {
          provider: API_FOOTBALL_PROVIDER,
          endpoint,
          retryAfterSeconds: secondsUntilUtcMidnight(),
        },
      );
    }

    if (this.burstExhaustedAt !== null) {
      const elapsed = Date.now() - this.burstExhaustedAt;
      if (elapsed < BURST_WINDOW_MS) {
        throw new SportsProviderError(
          'RATE_LIMITED',
          `${endpoint} was not attempted: the per-minute allowance is spent.`,
          {
            provider: API_FOOTBALL_PROVIDER,
            endpoint,
            retryAfterSeconds: Math.ceil((BURST_WINDOW_MS - elapsed) / 1000),
          },
        );
      }
      this.burstExhaustedAt = null;
    }
  }

  /** Remembers a counter that reached zero so the next call can be skipped. */
  private markExhausted(snapshot: RateLimitSnapshot): void {
    if (snapshot.dailyRemaining === 0) this.exhaustedOnUtcDay = utcDay(new Date());
    if (snapshot.burstRemaining === 0) this.burstExhaustedAt = Date.now();
  }

  private warnOnLowQuota(endpoint: string, snapshot: RateLimitSnapshot): void {
    if (snapshot.dailyRemaining !== null && snapshot.dailyRemaining <= LOW_QUOTA_THRESHOLD) {
      sportsLog.warn('provider daily quota nearly exhausted', {
        endpoint,
        remaining: snapshot.dailyRemaining,
        limit: snapshot.dailyLimit,
      });
    }
  }

  /**
   * One line per response, carrying exactly what was missing while a healthy
   * 200 was being read as a rate limit — and nothing that could identify the
   * key. The envelope's `errors` are included verbatim after redaction because
   * their *shape* is the whole diagnosis.
   */
  private logDiagnostics(
    endpoint: string,
    status: number,
    snapshot: RateLimitSnapshot,
    envelope: ApiFootballEnvelope<unknown>,
    errorMessage: string | undefined,
  ): void {
    if (!this.diagnostics) return;

    sportsLog.info('provider response', {
      endpoint,
      status,
      dailyLimit: snapshot.dailyLimit,
      dailyRemaining: snapshot.dailyRemaining,
      burstLimit: snapshot.burstLimit,
      burstRemaining: snapshot.burstRemaining,
      results: envelope.results ?? null,
      returned: Array.isArray(envelope.response) ? envelope.response.length : null,
      errors: errorMessage ? this.safe(errorMessage) : null,
    });
  }

  private observe(observation: Omit<QuotaObservation, 'observedAt'>): void {
    const full: QuotaObservation = { ...observation, observedAt: new Date() };
    this.lastObservation = full;
    this.onQuota?.(full);
  }

  private httpError(
    response: Response,
    endpoint: string,
    snapshot: RateLimitSnapshot,
  ): SportsProviderError {
    const retryAfterSeconds = readRetryAfter(response);
    const base = {
      provider: API_FOOTBALL_PROVIDER,
      endpoint,
      status: response.status,
      retryAfterSeconds,
    };

    // Credentials first: a 401/403 is about the key, whatever the counters say.
    if (response.status === 401 || response.status === 403) {
      return new SportsProviderError(
        'AUTH_FAILED',
        `${endpoint} rejected the configured API key.`,
        base,
      );
    }

    const verdict = isActuallyRateLimited({ status: response.status, snapshot, retryAfterSeconds });
    if (verdict.limited) {
      this.markExhausted(snapshot);
      return new SportsProviderError('RATE_LIMITED', `${endpoint} hit the provider rate limit.`, {
        ...base,
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
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

function readRetryAfter(response: Response): number | null {
  const value = Number(response.headers.get('retry-after'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The v3 API answers `200 OK` with a populated `errors` object for application
 * failures — a dead key, a season outside the plan, an exhausted allowance — so
 * a successful HTTP status is not by itself a successful call. An `errors` that
 * is an empty array, which is what a healthy response carries, is not an error.
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
