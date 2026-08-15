/**
 * Failure taxonomy for sports feeds.
 *
 * Callers branch on `code`, never on message text, so the wording can change
 * without breaking the sync service or the admin screen. Messages are written
 * for an operator reading a sync run — and they never carry a credential.
 */

export type SportsErrorCode =
  /** No API key configured. Expected state, not a bug. */
  | 'MISSING_API_KEY'
  /** Key present but rejected by the provider. */
  | 'AUTH_FAILED'
  /** Plan quota or per-minute rate limit exhausted. */
  | 'RATE_LIMITED'
  /** Non-2xx HTTP response. */
  | 'HTTP_ERROR'
  /**
   * The plan does not include the data that was asked for.
   *
   * Distinct from `RATE_LIMITED` on purpose: no amount of waiting turns a
   * subscription into a different subscription, so this is not retryable and
   * the operator needs to change the request, not the schedule.
   */
  | 'PLAN_RESTRICTED'
  /** 2xx response whose body reported an application-level error. */
  | 'PROVIDER_ERROR'
  /** Response was not the shape the adapter expects. */
  | 'INVALID_RESPONSE'
  /** Request exceeded the client timeout or was aborted. */
  | 'TIMEOUT'
  /** Connection failed before a response arrived. */
  | 'NETWORK_ERROR'
  /** The provider answered, but the rows could not be written. */
  | 'DATABASE_ERROR';

export class SportsProviderError extends Error {
  readonly code: SportsErrorCode;
  readonly provider: string;
  readonly endpoint: string | null;
  readonly status: number | null;
  /** Seconds to wait before retrying, when the provider says so. */
  readonly retryAfterSeconds: number | null;

  constructor(
    code: SportsErrorCode,
    message: string,
    options: {
      provider: string;
      endpoint?: string | null;
      status?: number | null;
      retryAfterSeconds?: number | null;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'SportsProviderError';
    this.code = code;
    this.provider = options.provider;
    this.endpoint = options.endpoint ?? null;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /** True when retrying later could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.code === 'RATE_LIMITED' ||
      this.code === 'TIMEOUT' ||
      this.code === 'NETWORK_ERROR' ||
      (this.code === 'HTTP_ERROR' && (this.status ?? 0) >= 500)
    );
  }

  /** One line, safe to store in a sync run and show in the admin screen. */
  toSummary(): string {
    const where = this.endpoint ? ` (${this.endpoint})` : '';
    return `[${this.code}]${where} ${this.message}`;
  }
}

export function isSportsProviderError(error: unknown): error is SportsProviderError {
  return error instanceof SportsProviderError;
}

/**
 * HTTP status to answer with when a sync fails.
 *
 * A blanket 502 tells an admin nothing: a missing key, a spent quota and a
 * plan restriction all need different actions, and the status code is the first
 * thing anyone reads. Only genuinely unclassified provider trouble stays 502.
 */
export function httpStatusForCode(code: SportsErrorCode | null): number {
  switch (code) {
    case 'MISSING_API_KEY':
      return 503;
    case 'AUTH_FAILED':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'PLAN_RESTRICTED':
      return 422;
    case 'TIMEOUT':
      return 504;
    case 'NETWORK_ERROR':
      return 503;
    case 'DATABASE_ERROR':
      return 500;
    default:
      return 502;
  }
}

const SUMMARY_CODE = /^\[([A-Z_]+)\]/;

/** Recovers the code from a stored summary line written by `toSummary()`. */
export function codeFromSummary(summary: string | null | undefined): SportsErrorCode | null {
  const match = summary ? SUMMARY_CODE.exec(summary) : null;
  return match ? (match[1] as SportsErrorCode) : null;
}

/**
 * Turns anything thrown into a summary line.
 *
 * Sync must never crash on an unexpected throw: whatever comes back is recorded
 * and the run is marked `partial` or `failed`.
 */
export function describeError(error: unknown): string {
  if (isSportsProviderError(error)) return error.toSummary();
  if (error instanceof Error) return `[UNEXPECTED] ${error.message}`;
  return `[UNEXPECTED] ${String(error)}`;
}
