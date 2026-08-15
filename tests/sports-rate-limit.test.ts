/**
 * Quota interpretation.
 *
 * These are the tests that pin down the bug this module was written to fix: an
 * HTTP 200 carrying real data was being reported as `RATE_LIMITED` because the
 * envelope's error key happened to be named `plan`. Several cases below exist
 * only to make that mistake, and its neighbours, impossible to reintroduce.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOW_QUOTA_THRESHOLD,
  classifyEnvelopeError,
  isActuallyRateLimited,
  isRateLimitUnknown,
  parseRateLimitHeaders,
  secondsUntilUtcMidnight,
} from '../src/lib/sports/providers/api-football/rate-limit.ts';

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('parseRateLimitHeaders', () => {
  it('reads the daily and burst pairs into separate fields', () => {
    const snapshot = parseRateLimitHeaders(
      headers({
        'x-ratelimit-requests-limit': '100',
        'x-ratelimit-requests-remaining': '99',
        'x-ratelimit-limit': '10',
        'x-ratelimit-remaining': '9',
      }),
    );

    assert.deepEqual(snapshot, {
      dailyLimit: 100,
      dailyRemaining: 99,
      burstLimit: 10,
      burstRemaining: 9,
    });
  });

  it('does not confuse the burst pair with the daily pair', () => {
    // `x-ratelimit-limit` is a prefix of nothing: header lookup matches the
    // whole name, so the daily counters must stay unknown here.
    const snapshot = parseRateLimitHeaders(
      headers({ 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': '4' }),
    );

    assert.equal(snapshot.burstLimit, 10);
    assert.equal(snapshot.burstRemaining, 4);
    assert.equal(snapshot.dailyLimit, null);
    assert.equal(snapshot.dailyRemaining, null);
  });

  it('is case-insensitive, as HTTP headers are', () => {
    const snapshot = parseRateLimitHeaders(
      headers({ 'X-RateLimit-Requests-Remaining': '42', 'X-RateLimit-Remaining': '7' }),
    );

    assert.equal(snapshot.dailyRemaining, 42);
    assert.equal(snapshot.burstRemaining, 7);
  });

  it('reports unknown — not zero — when the headers are absent', () => {
    const snapshot = parseRateLimitHeaders(headers({}));

    assert.deepEqual(snapshot, {
      dailyLimit: null,
      dailyRemaining: null,
      burstLimit: null,
      burstRemaining: null,
    });
    assert.equal(isRateLimitUnknown(snapshot), true);
  });

  it('treats blank and malformed values as unknown rather than as zero', () => {
    const snapshot = parseRateLimitHeaders(
      headers({
        'x-ratelimit-requests-remaining': '   ',
        'x-ratelimit-remaining': 'unlimited',
      }),
    );

    assert.equal(snapshot.dailyRemaining, null, 'a blank header is not "zero left"');
    assert.equal(snapshot.burstRemaining, null);
  });

  it('accepts a Response as well as a Headers', () => {
    const response = new Response('{}', {
      headers: { 'x-ratelimit-requests-remaining': '55' },
    });
    assert.equal(parseRateLimitHeaders(response).dailyRemaining, 55);
  });
});

describe('isActuallyRateLimited', () => {
  it('says no for a healthy response with allowance left', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      snapshot: { dailyLimit: 100, dailyRemaining: 99, burstLimit: 10, burstRemaining: 9 },
      fields: [],
      message: '',
    });

    assert.equal(verdict.limited, false);
    assert.equal(verdict.reason, null);
  });

  it('says no when the provider sent no headers at all', () => {
    const verdict = isActuallyRateLimited({ status: 200 });
    assert.equal(verdict.limited, false, 'missing headers must never fail a request');
  });

  it('says yes for HTTP 429 and carries retry-after', () => {
    const verdict = isActuallyRateLimited({ status: 429, retryAfterSeconds: 30 });

    assert.equal(verdict.limited, true);
    assert.equal(verdict.reason, 'HTTP_429');
    assert.equal(verdict.retryAfterSeconds, 30);
  });

  it('says yes when the daily counter is genuinely zero', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      snapshot: { dailyLimit: 100, dailyRemaining: 0, burstLimit: 10, burstRemaining: 9 },
    });

    assert.equal(verdict.limited, true);
    assert.equal(verdict.reason, 'DAILY_QUOTA_EXHAUSTED');
    assert.ok((verdict.retryAfterSeconds ?? 0) > 0, 'the daily counter resets at midnight UTC');
  });

  it('says yes when the burst counter is zero even though the day has room', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      snapshot: { dailyLimit: 100, dailyRemaining: 80, burstLimit: 10, burstRemaining: 0 },
    });

    assert.equal(verdict.limited, true);
    assert.equal(verdict.reason, 'BURST_QUOTA_EXHAUSTED');
  });

  it('says yes for an explicit quota message in a 200 payload', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      fields: ['requests'],
      message: 'requests: You have reached the request limit for the day',
    });

    assert.equal(verdict.limited, true);
    assert.equal(verdict.reason, 'PROVIDER_PAYLOAD');
  });

  it('says NO for a plan restriction — the regression this module exists for', () => {
    // Observed verbatim from the Free plan, with 99 of 100 requests unspent.
    const verdict = isActuallyRateLimited({
      status: 200,
      fields: ['plan'],
      message: 'plan: Free plans do not have access to this season, try from 2022 to 2024.',
    });

    assert.equal(verdict.limited, false, 'a plan restriction is a capability, not a quota');
  });

  it('says no for a plan restriction on the date window either', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      fields: ['plan'],
      message:
        'plan: Free plans do not have access to this date, try with a date within the last week.',
    });

    assert.equal(verdict.limited, false);
  });

  it('says no for an empty result set', () => {
    const verdict = isActuallyRateLimited({
      status: 200,
      snapshot: { dailyLimit: 100, dailyRemaining: 98, burstLimit: 10, burstRemaining: 9 },
      fields: [],
      message: '',
    });

    assert.equal(verdict.limited, false, 'zero fixtures today is a fact, not a rate limit');
  });
});

describe('classifyEnvelopeError', () => {
  it('maps a plan complaint to PLAN_RESTRICTED', () => {
    const { code } = classifyEnvelopeError({
      status: 200,
      fields: ['plan'],
      message: 'plan: Free plans do not have access to this season, try from 2022 to 2024.',
    });

    assert.equal(code, 'PLAN_RESTRICTED');
  });

  it('maps a spent allowance to RATE_LIMITED', () => {
    const { code, retryAfterSeconds } = classifyEnvelopeError({
      status: 200,
      fields: ['requests'],
      message: 'requests: Too many requests. Your rate limit is 10 requests per minute.',
    });

    assert.equal(code, 'RATE_LIMITED');
    assert.ok((retryAfterSeconds ?? 0) > 0);
  });

  it('maps a token complaint to AUTH_FAILED', () => {
    const { code } = classifyEnvelopeError({
      status: 200,
      fields: ['token'],
      message: 'token: Error/Missing application key.',
    });

    assert.equal(code, 'AUTH_FAILED');
  });

  it('maps anything unrecognised to PROVIDER_ERROR', () => {
    const { code } = classifyEnvelopeError({
      status: 200,
      fields: ['bug'],
      message: 'bug: Internal error',
    });

    assert.equal(code, 'PROVIDER_ERROR');
  });

  it('prefers RATE_LIMITED over PLAN_RESTRICTED when the counter really is zero', () => {
    // Both signals present: the measured counter wins, because waiting fixes it.
    const { code } = classifyEnvelopeError({
      status: 200,
      fields: ['plan'],
      message: 'plan: Free plans do not have access to this season.',
      snapshot: { dailyLimit: 100, dailyRemaining: 0, burstLimit: 10, burstRemaining: 0 },
    });

    assert.equal(code, 'RATE_LIMITED');
  });
});

describe('quota helpers', () => {
  it('counts the seconds to the next UTC midnight', () => {
    const seconds = secondsUntilUtcMidnight(new Date('2026-08-15T23:00:00Z'));
    assert.equal(seconds, 3600);
  });

  it('never returns a non-positive wait', () => {
    const seconds = secondsUntilUtcMidnight(new Date('2026-08-15T23:59:59.999Z'));
    assert.ok(seconds >= 1);
  });

  it('warns while there is still allowance to protect', () => {
    assert.ok(LOW_QUOTA_THRESHOLD > 0, 'a threshold of zero would warn only once it is too late');
  });
});
