/**
 * Rate-limit and quota interpretation for API-Football v3.
 *
 * This module exists because of a specific, expensive class of bug: reading a
 * *perfectly healthy* response as an exhausted quota. API-Football answers
 * `200 OK` for application-level failures, and the shape of those failures
 * varies — a dead key, a season the plan cannot see, a spent allowance all
 * arrive the same way. Guessing from the presence of a header, or from a field
 * name that merely sounds quota-ish, produces false positives that stop the
 * pipeline while the allowance is untouched.
 *
 * So the rules here are deliberately narrow. A response is rate limited only
 * when the provider *says so*: HTTP 429, a counter that has actually reached
 * zero, or a payload message about spent requests. Everything else — including
 * a completely absent set of headers — is not a rate limit.
 *
 * Two header pairs are in play, and they mean different things:
 *
 *   `x-ratelimit-requests-limit` / `x-ratelimit-requests-remaining`  daily quota
 *   `x-ratelimit-limit`          / `x-ratelimit-remaining`           per-minute burst
 *
 * `Headers.get()` matches a name in full and case-insensitively, so the shorter
 * pair cannot accidentally pick up the longer one.
 */

export interface RateLimitSnapshot {
  /** Requests the plan allows per day. */
  dailyLimit: number | null;
  /** Requests left today, or `null` when the provider did not say. */
  dailyRemaining: number | null;
  /** Requests the plan allows per minute. */
  burstLimit: number | null;
  /** Requests left in the current minute, or `null` when the provider did not say. */
  burstRemaining: number | null;
}

/** What we know when the provider tells us nothing: nothing. */
export const UNKNOWN_RATE_LIMIT: RateLimitSnapshot = {
  dailyLimit: null,
  dailyRemaining: null,
  burstLimit: null,
  burstRemaining: null,
};

/** Below this many daily requests the admin screen shows a warning. */
export const LOW_QUOTA_THRESHOLD = 10;

/**
 * Parses a counter header.
 *
 * Returns `null` — meaning *unknown* — for anything that is not a plain
 * non-negative number. A blank or malformed header is not "zero left"; treating
 * it as zero is precisely how a working feed gets shut off.
 */
function toCount(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/**
 * The single place rate-limit headers are read.
 *
 * Every endpoint goes through here, so there is one interpretation of the quota
 * in the codebase rather than one per call site.
 */
export function parseRateLimitHeaders(source: Response | Headers): RateLimitSnapshot {
  const headers = source instanceof Headers ? source : source.headers;

  return {
    dailyLimit: toCount(headers.get('x-ratelimit-requests-limit')),
    dailyRemaining: toCount(headers.get('x-ratelimit-requests-remaining')),
    burstLimit: toCount(headers.get('x-ratelimit-limit')),
    burstRemaining: toCount(headers.get('x-ratelimit-remaining')),
  };
}

/** True when the provider sent no usable counters at all. */
export function isRateLimitUnknown(snapshot: RateLimitSnapshot): boolean {
  return (
    snapshot.dailyLimit === null &&
    snapshot.dailyRemaining === null &&
    snapshot.burstLimit === null &&
    snapshot.burstRemaining === null
  );
}

/**
 * Messages that describe a *spent allowance*.
 *
 * Kept separate from plan messages below because the two need opposite
 * responses: waiting fixes a quota, and never fixes a plan.
 */
const QUOTA_EXHAUSTED_MESSAGE =
  /(reach|exceed|exhaust|out of|no more).{0,40}(request|quota|limit|call)|limit for the day|daily limit|too many requests|rate.?limit(ed)?\b/i;

/** Messages that describe a *capability the plan does not include*. */
const PLAN_RESTRICTION_MESSAGE =
  /free plan|do(es)? not have access|not allowed|upgrade|your (current )?plan|subscription/i;

/** Envelope error keys that unambiguously mean the credential is bad. */
const AUTH_FIELDS = new Set(['token', 'access', 'key', 'apikey', 'api_key']);

/**
 * Envelope error keys that unambiguously mean the allowance is spent.
 *
 * `plan` is deliberately absent. It was the cause of the false positive this
 * module was written to end: `errors.plan` is what the provider returns for
 * "this season is not in your subscription", which has nothing to do with the
 * request count.
 */
const QUOTA_FIELDS = new Set(['requests', 'ratelimit', 'rate_limit']);

export type RateLimitReason =
  | 'HTTP_429'
  | 'DAILY_QUOTA_EXHAUSTED'
  | 'BURST_QUOTA_EXHAUSTED'
  | 'PROVIDER_PAYLOAD';

export interface RateLimitVerdict {
  limited: boolean;
  reason: RateLimitReason | null;
  /** Seconds to wait before a retry could plausibly succeed. */
  retryAfterSeconds: number | null;
}

export interface RateLimitInput {
  /** HTTP status, when there was a response. */
  status?: number | null;
  snapshot?: RateLimitSnapshot | null;
  /** Lower-cased keys of the envelope's `errors` object. */
  fields?: string[];
  /** Human text from the envelope's `errors`, if any. */
  message?: string | null;
  /** Value of the `retry-after` header, in seconds. */
  retryAfterSeconds?: number | null;
  /** Injected in tests; production uses the wall clock. */
  now?: Date;
}

/**
 * The one question every caller asks: *is this actually a rate limit?*
 *
 * Answers `false` unless the provider gave a positive signal. Absent headers,
 * an empty result set, or a plan complaint all come back `false`, because none
 * of them means the allowance is gone.
 */
export function isActuallyRateLimited(input: RateLimitInput): RateLimitVerdict {
  const snapshot = input.snapshot ?? UNKNOWN_RATE_LIMIT;
  const now = input.now ?? new Date();

  // 1. The provider said so in the clearest way available.
  if (input.status === 429) {
    return {
      limited: true,
      reason: 'HTTP_429',
      retryAfterSeconds: input.retryAfterSeconds ?? 60,
    };
  }

  // 2. A counter that genuinely reached zero. Note `=== 0`, not falsy: `null`
  //    means the header was absent, which is not the same as empty.
  if (snapshot.dailyRemaining === 0) {
    return {
      limited: true,
      reason: 'DAILY_QUOTA_EXHAUSTED',
      retryAfterSeconds: input.retryAfterSeconds ?? secondsUntilUtcMidnight(now),
    };
  }

  if (snapshot.burstRemaining === 0) {
    return {
      limited: true,
      reason: 'BURST_QUOTA_EXHAUSTED',
      retryAfterSeconds: input.retryAfterSeconds ?? 60,
    };
  }

  // 3. An explicit rate-limit error in the payload of an otherwise-200 answer.
  const fields = input.fields ?? [];
  const message = input.message ?? '';
  const quotaField = fields.some((field) => QUOTA_FIELDS.has(field));
  const saysExhausted = QUOTA_EXHAUSTED_MESSAGE.test(message);
  const saysPlan = PLAN_RESTRICTION_MESSAGE.test(message);

  // A quota-keyed error counts even if the wording is unfamiliar; an unkeyed
  // one counts only when the text is about spent requests rather than about
  // what the subscription includes.
  if (quotaField && (saysExhausted || !saysPlan)) {
    return {
      limited: true,
      reason: 'PROVIDER_PAYLOAD',
      retryAfterSeconds: input.retryAfterSeconds ?? secondsUntilUtcMidnight(now),
    };
  }
  if (saysExhausted && !saysPlan) {
    return {
      limited: true,
      reason: 'PROVIDER_PAYLOAD',
      retryAfterSeconds: input.retryAfterSeconds ?? secondsUntilUtcMidnight(now),
    };
  }

  return { limited: false, reason: null, retryAfterSeconds: null };
}

/** When the daily counter resets, in seconds from `now`. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

export type EnvelopeErrorCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'PLAN_RESTRICTED'
  | 'PROVIDER_ERROR';

export interface EnvelopeClassification {
  code: EnvelopeErrorCode;
  retryAfterSeconds: number | null;
}

/**
 * Classifies an application-level error carried by a `200 OK` envelope.
 *
 * Precedence is credential → allowance → capability → everything else, because
 * that is the order in which an operator can act on them: a bad key is fixed by
 * replacing it, a spent quota by waiting, a plan restriction by asking for
 * different data, and the rest by reading the message.
 */
export function classifyEnvelopeError(input: RateLimitInput): EnvelopeClassification {
  const fields = input.fields ?? [];
  const message = input.message ?? '';

  if (fields.some((field) => AUTH_FIELDS.has(field))) {
    return { code: 'AUTH_FAILED', retryAfterSeconds: null };
  }

  const verdict = isActuallyRateLimited(input);
  if (verdict.limited) {
    return { code: 'RATE_LIMITED', retryAfterSeconds: verdict.retryAfterSeconds };
  }

  if (fields.includes('plan') || PLAN_RESTRICTION_MESSAGE.test(message)) {
    return { code: 'PLAN_RESTRICTED', retryAfterSeconds: null };
  }

  return { code: 'PROVIDER_ERROR', retryAfterSeconds: null };
}
