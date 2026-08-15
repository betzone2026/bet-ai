import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { CallbackResult, User } from '@netlify/identity';
import {
  type RedemptionDeps,
  type RedemptionOutcome,
  authTokenParam,
  redeemCallbackOnce,
  resetRedemptionState,
} from '../src/lib/auth/callback-tokens.ts';

const USER = { id: 'u_1', email: 'new@example.com' } as User;

/** A working confirmation: token redeemed, user returned, session cookie written. */
function confirmed(): CallbackResult {
  return { type: 'confirmation', user: USER };
}

interface Harness {
  deps: RedemptionDeps;
  /** How many times the SDK redemption was actually invoked. */
  calls: () => number;
  /** Diagnostic events, in order. */
  events: () => string[];
  /** Everything the diagnostics were given, to assert no secret leaked. */
  logged: () => string;
}

function harness(options: {
  hash?: string;
  result?: CallbackResult | null;
  error?: Error;
  sessionCookie?: boolean;
}): Harness {
  let calls = 0;
  const events: string[] = [];
  const logged: string[] = [];

  return {
    calls: () => calls,
    events: () => events,
    logged: () => logged.join(' '),
    deps: {
      readHash: () => options.hash ?? '',
      redeem: async () => {
        calls += 1;
        // A real redemption is asynchronous, so overlapping callers have a
        // window in which to race. Yielding here keeps that window open.
        await Promise.resolve();
        if (options.error) throw options.error;
        return options.result ?? null;
      },
      hasSessionCookie: () => options.sessionCookie ?? false,
      log: (event, detail) => {
        events.push(event);
        logged.push(event, JSON.stringify(detail ?? {}));
      },
    },
  };
}

beforeEach(resetRedemptionState);

describe('confirmation token recognition', () => {
  it('names the token type without exposing the value', () => {
    assert.equal(authTokenParam('#confirmation_token=secret-value'), 'confirmation_token');
    assert.equal(authTokenParam('#recovery_token=abc'), 'recovery_token');
    assert.equal(authTokenParam('#invite_token=abc'), 'invite_token');
    assert.equal(authTokenParam('#access_token=abc'), 'access_token');
    assert.equal(authTokenParam('#email_change_token=abc'), 'email_change_token');
  });

  it('reports no token for an ordinary fragment', () => {
    assert.equal(authTokenParam(''), null);
    assert.equal(authTokenParam('#pricing'), null);
    assert.equal(authTokenParam('#confirmation_token='), null);
  });

  it('resolves the parameter the SDK would act on first', () => {
    // `handleAuthCallback()` checks `access_token` before `confirmation_token`,
    // so a fragment carrying both must be reported as OAuth.
    assert.equal(authTokenParam('#confirmation_token=a&access_token=b'), 'access_token');
  });
});

describe('single redemption', () => {
  it('redeems a confirmation token exactly once across concurrent callers', async () => {
    const h = harness({
      hash: '#confirmation_token=abc',
      result: confirmed(),
      sessionCookie: true,
    });

    // Strict Mode's double-invoked effect, modelled: two callers, no await
    // between them.
    const [first, second] = await Promise.all([
      redeemCallbackOnce(h.deps),
      redeemCallbackOnce(h.deps),
    ]);

    assert.equal(h.calls(), 1, 'the single-use token must be spent once');
    assert.deepEqual(first, second, 'both callers observe the same outcome');
    assert.equal(first.status, 'redeemed');
  });

  it('does not redeem again for a caller that arrives after completion', async () => {
    const h = harness({
      hash: '#confirmation_token=abc',
      result: confirmed(),
      sessionCookie: true,
    });

    const first = await redeemCallbackOnce(h.deps);
    const later = await redeemCallbackOnce(h.deps);

    assert.equal(h.calls(), 1);
    assert.deepEqual(first, later);
  });

  it('sends a confirmed user to the dashboard', async () => {
    const h = harness({
      hash: '#confirmation_token=abc',
      result: confirmed(),
      sessionCookie: true,
    });

    const outcome = await redeemCallbackOnce(h.deps);

    assert.deepEqual(outcome, {
      status: 'redeemed',
      type: 'confirmation',
      destination: '/dashboard',
    } satisfies RedemptionOutcome);
  });
});

describe('session verification', () => {
  it('refuses to call it a success when no session cookie was written', async () => {
    // The client-side session alone is invisible to the server render, so
    // redirecting here is exactly what produced a spurious "session expired".
    const h = harness({
      hash: '#confirmation_token=abc',
      result: confirmed(),
      sessionCookie: false,
    });

    assert.equal((await redeemCallbackOnce(h.deps)).status, 'unverified');
  });

  it('refuses to call it a success when no user came back', async () => {
    const h = harness({
      hash: '#confirmation_token=abc',
      result: { type: 'confirmation', user: null },
      sessionCookie: true,
    });

    assert.equal((await redeemCallbackOnce(h.deps)).status, 'unverified');
  });

  it('accepts an invite, which has a token and deliberately no session', async () => {
    const h = harness({
      hash: '#invite_token=abc',
      result: { type: 'invite', user: null, token: 'abc' },
      sessionCookie: false,
    });

    const outcome = await redeemCallbackOnce(h.deps);

    assert.equal(outcome.status, 'redeemed');
    assert.equal(outcome.status === 'redeemed' && outcome.destination, '/accept-invite#accept=abc');
  });

  it('sends a recovery callback to the password form, not the dashboard', async () => {
    const h = harness({
      hash: '#recovery_token=abc',
      result: { type: 'recovery', user: USER },
      sessionCookie: true,
    });

    const outcome = await redeemCallbackOnce(h.deps);

    assert.equal(outcome.status === 'redeemed' && outcome.destination, '/update-password');
  });
});

describe('failure handling', () => {
  it('reports an already-used token as a graceful failure, not a crash', async () => {
    const h = harness({
      hash: '#confirmation_token=spent',
      error: Object.assign(new Error('Token has expired or is invalid'), { status: 401 }),
    });

    const outcome = await redeemCallbackOnce(h.deps);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.status === 'failed' && outcome.message, 'Token has expired or is invalid');
    assert.equal(h.calls(), 1, 'a rejected token is not retried');
  });

  it('does not retry after a failure', async () => {
    const h = harness({ hash: '#confirmation_token=spent', error: new Error('nope') });

    await redeemCallbackOnce(h.deps);
    await redeemCallbackOnce(h.deps);

    assert.equal(h.calls(), 1);
  });

  it('handles a missing token without attempting redemption', async () => {
    const h = harness({ hash: '' });

    assert.equal((await redeemCallbackOnce(h.deps)).status, 'absent');
    assert.equal(h.calls(), 0, 'nothing to redeem, so the SDK is never called');
  });

  it('treats an unrelated fragment as no token at all', async () => {
    const h = harness({ hash: '#section=pricing' });

    assert.equal((await redeemCallbackOnce(h.deps)).status, 'absent');
    assert.equal(h.calls(), 0);
  });

  it('reports a token the SDK found already consumed, without erroring', async () => {
    // The fragment held a token when read, but the SDK saw none: something else
    // redeemed it and cleared the hash first.
    const h = harness({ hash: '#confirmation_token=abc', result: null });

    assert.equal((await redeemCallbackOnce(h.deps)).status, 'consumed');
  });
});

describe('diagnostics', () => {
  it('records the flow without ever recording the token', async () => {
    const h = harness({
      hash: '#confirmation_token=super-secret-token-value',
      result: confirmed(),
      sessionCookie: true,
    });

    await redeemCallbackOnce(h.deps);

    assert.deepEqual(h.events(), [
      'callback started',
      'handleAuthCallback started',
      'handleAuthCallback success',
      'redirect destination',
    ]);
    assert.ok(h.logged().includes('"tokenType":"confirmation_token"'));
    assert.ok(h.logged().includes('"sessionCookieDetected":true'));
    assert.ok(
      !h.logged().includes('super-secret-token-value'),
      'the token value must never reach the diagnostics',
    );
  });
});
