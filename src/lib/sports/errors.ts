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
  /** 2xx response whose body reported an application-level error. */
  | 'PROVIDER_ERROR'
  /** Response was not the shape the adapter expects. */
  | 'INVALID_RESPONSE'
  /** Request exceeded the client timeout or was aborted. */
  | 'TIMEOUT'
  /** Connection failed before a response arrived. */
  | 'NETWORK_ERROR';

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
