/**
 * Transport behaviour of the API-Football client.
 *
 * Every request is served by an injected `fetch`, so the suite never reaches
 * the network and never spends a request against the real quota. The key used
 * throughout is a fabricated string.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiFootballClient } from '../src/lib/sports/providers/api-football/client.ts';
import { ApiFootballProvider } from '../src/lib/sports/providers/api-football/provider.ts';
import { isSportsProviderError } from '../src/lib/sports/errors.ts';

const TEST_KEY = 'test-key-not-a-real-credential';

/** Builds a `fetch` that answers with a fixed response and records the calls. */
function stubFetch(
  responder: (url: string, init: RequestInit | undefined) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return responder(url, init);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function envelope(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

const OK_BODY = {
  get: 'fixtures',
  parameters: {},
  errors: [],
  results: 1,
  paging: { current: 1, total: 1 },
  response: [{ fixture: { id: 1 } }],
};

describe('api key handling', () => {
  it('reports itself unconfigured when no key is supplied', () => {
    const client = new ApiFootballClient({ apiKey: null });
    assert.equal(client.isConfigured(), false);
  });

  it('refuses to call the provider without a key', async () => {
    const { impl, calls } = stubFetch(() => envelope(OK_BODY));
    const client = new ApiFootballClient({ apiKey: null, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', { date: '2026-08-15' }),
      (error: unknown) => isSportsProviderError(error) && error.code === 'MISSING_API_KEY',
    );
    assert.equal(calls.length, 0, 'no HTTP request may be attempted without a key');
  });

  it('sends the key as a header and never in the URL', async () => {
    const { impl, calls } = stubFetch(() => envelope(OK_BODY));
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await client.get('fixtures', { date: '2026-08-15', league: '135' });

    const call = calls[0];
    assert.ok(call);
    assert.ok(!call.url.includes(TEST_KEY), 'the key must not appear in the request URL');
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get('x-apisports-key'), TEST_KEY);
    assert.match(call.url, /\/fixtures\?/);
    assert.match(call.url, /date=2026-08-15/);
  });

  it('keeps the key out of error messages', async () => {
    const { impl } = stubFetch(() =>
      envelope({ message: `rejected key ${TEST_KEY}` }, { status: 500 }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.ok(!error.message.includes(TEST_KEY), 'the key must never be echoed back');
        assert.ok(!error.toSummary().includes(TEST_KEY));
        return true;
      },
    );
  });
});

describe('error classification', () => {
  it('maps 429 to a retryable rate-limit error', async () => {
    const { impl } = stubFetch(() =>
      new Response('{}', { status: 429, headers: { 'retry-after': '30' } }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.equal(error.code, 'RATE_LIMITED');
        assert.equal(error.retryable, true);
        assert.equal(error.retryAfterSeconds, 30);
        return true;
      },
    );
  });

  it('maps 401 and 403 to an authentication failure', async () => {
    for (const status of [401, 403]) {
      const { impl } = stubFetch(() => new Response('{}', { status }));
      const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

      await assert.rejects(
        () => client.get('fixtures', {}),
        (error: unknown) => isSportsProviderError(error) && error.code === 'AUTH_FAILED',
      );
    }
  });

  it('maps any other non-2xx status to an HTTP error carrying the status', async () => {
    const { impl } = stubFetch(() => new Response('gateway', { status: 502 }));
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.equal(error.code, 'HTTP_ERROR');
        assert.equal(error.status, 502);
        assert.equal(error.endpoint, 'fixtures');
        return true;
      },
    );
  });

  it('treats a quota message in a 200 body as a rate limit', async () => {
    const { impl } = stubFetch(() =>
      envelope({
        get: 'fixtures',
        errors: { requests: 'You have reached the request limit for the day' },
        response: [],
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => isSportsProviderError(error) && error.code === 'RATE_LIMITED',
    );
  });

  it('treats a token message in a 200 body as an authentication failure', async () => {
    const { impl } = stubFetch(() =>
      envelope({ get: 'fixtures', errors: { token: 'Invalid API key' }, response: [] }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => isSportsProviderError(error) && error.code === 'AUTH_FAILED',
    );
  });

  it('rejects a body that is not a valid envelope', async () => {
    const { impl } = stubFetch(() =>
      new Response('<html>maintenance</html>', { status: 200 }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => isSportsProviderError(error) && error.code === 'INVALID_RESPONSE',
    );
  });

  it('reports a transport failure as a network error', async () => {
    const { impl } = stubFetch(() => {
      throw new TypeError('connection reset');
    });
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => isSportsProviderError(error) && error.code === 'NETWORK_ERROR',
    );
  });

  it('reports an aborted request as a timeout', async () => {
    const { impl } = stubFetch(() => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, timeoutMs: 5 });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.equal(error.code, 'TIMEOUT');
        assert.equal(error.retryable, true);
        return true;
      },
    );
  });
});

describe('request accounting', () => {
  it('counts requests per endpoint', async () => {
    const { impl } = stubFetch(() => envelope(OK_BODY));
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await client.get('fixtures', { league: '135' });
    await client.get('fixtures', { league: '39' });
    await client.get('standings', { league: '135' });

    const usage = Object.fromEntries(client.usage().map((row) => [row.endpoint, row.requests]));
    assert.equal(usage.fixtures, 2);
    assert.equal(usage.standings, 1);
  });

  it('reads the plan allowance out of the response headers', async () => {
    const { impl } = stubFetch(() =>
      envelope(OK_BODY, {
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-requests-limit': '7500',
          'x-ratelimit-requests-remaining': '7412',
          'x-ratelimit-limit': '300',
          'x-ratelimit-remaining': '299',
        },
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await client.get('fixtures', {});
    const limits = client.rateLimit();
    assert.equal(limits?.dailyLimit, 7500);
    assert.equal(limits?.dailyRemaining, 7412);
    assert.equal(limits?.minuteRemaining, 299);
  });
});

describe('provider behaviour without a key', () => {
  it('answers isConfigured() false and makes no request', async () => {
    const { impl, calls } = stubFetch(() => envelope(OK_BODY));
    const provider = new ApiFootballProvider({ apiKey: null, fetchImpl: impl });

    assert.equal(provider.isConfigured(), false);
    await assert.rejects(
      () => provider.getFixtures({ date: '2026-08-15' }),
      (error: unknown) => isSportsProviderError(error) && error.code === 'MISSING_API_KEY',
    );
    assert.equal(calls.length, 0);
  });
});

describe('provider fixture retrieval', () => {
  it('normalises the payload and requests one league at a time', async () => {
    const { impl, calls } = stubFetch((url) => {
      const league = new URL(url).searchParams.get('league');
      return envelope({
        get: 'fixtures',
        errors: [],
        results: 1,
        response: [
          {
            fixture: {
              id: league === '135' ? 1 : 2,
              date: '2026-08-22T18:45:00+00:00',
              status: { short: 'NS', elapsed: null },
            },
            league: { id: Number(league), name: 'Test', country: 'Italy', season: 2026 },
            teams: { home: { id: 10, name: 'Home' }, away: { id: 11, name: 'Away' } },
            goals: { home: null, away: null },
          },
        ],
      });
    });

    const provider = new ApiFootballProvider({ apiKey: TEST_KEY, fetchImpl: impl });
    const bundles = await provider.getFixtures({
      date: '2026-08-22',
      leagues: ['serie_a', 'premier_league'],
    });

    assert.equal(calls.length, 2, 'one request per configured competition');
    assert.equal(bundles.length, 2);
    assert.equal(bundles[0]?.fixture.id, 'af-1');
    assert.equal(bundles[0]?.fixture.status, 'scheduled');
    assert.equal(provider.usage().reduce((total, row) => total + row.requests, 0), 2);
  });
});
