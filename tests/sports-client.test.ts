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

  it('treats a plan restriction as PLAN_RESTRICTED, not as a rate limit', async () => {
    // Observed verbatim: this is the response that used to be reported as
    // `RATE_LIMITED status: 200` while 99 of 100 daily requests were unspent.
    const { impl } = stubFetch(() =>
      envelope({
        get: 'fixtures',
        parameters: { league: '135', season: '2026', date: '2026-08-15' },
        errors: { plan: 'Free plans do not have access to this season, try from 2022 to 2024.' },
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.equal(error.code, 'PLAN_RESTRICTED');
        assert.equal(error.retryable, false, 'waiting cannot fix a plan restriction');
        return true;
      },
    );
  });

  it('treats an unrecognised provider complaint as PROVIDER_ERROR', async () => {
    const { impl } = stubFetch(() =>
      envelope({ get: 'fixtures', errors: { bug: 'Internal error' }, response: [] }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl });

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => isSportsProviderError(error) && error.code === 'PROVIDER_ERROR',
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
    assert.equal(limits?.burstLimit, 300);
    assert.equal(limits?.burstRemaining, 299);
  });

  it('reports the last response so the admin screen can show it', async () => {
    const { impl } = stubFetch(() =>
      envelope(OK_BODY, {
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '99',
        },
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, diagnostics: false });

    await client.get('fixtures', {});
    const last = client.lastResponse();
    assert.equal(last?.outcome, 'SUCCESS');
    assert.equal(last?.status, 200);
    assert.equal(last?.endpoint, 'fixtures');
    assert.equal(last?.resultCount, 1);
    assert.equal(last?.message, null);
  });
});

describe('healthy responses are not mistaken for rate limits', () => {
  it('accepts HTTP 200 with allowance remaining', async () => {
    const { impl } = stubFetch(() =>
      envelope(OK_BODY, {
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '99',
          'x-ratelimit-limit': '10',
          'x-ratelimit-remaining': '9',
        },
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, diagnostics: false });

    const result = await client.get('fixtures', { date: '2026-08-15' });
    assert.equal(result.response?.length, 1);
    assert.equal(client.rateLimit()?.dailyRemaining, 99);
  });

  it('accepts HTTP 200 with an empty fixture list as a success with 0 fixtures', async () => {
    const { impl } = stubFetch(() =>
      envelope(
        { get: 'fixtures', errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] },
        {
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-requests-remaining': '98',
          },
        },
      ),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, diagnostics: false });

    const result = await client.get('fixtures', { date: '2026-08-15' });
    assert.deepEqual(result.response, [], 'an empty slate is a valid answer, not a failure');
    assert.equal(client.lastResponse()?.outcome, 'SUCCESS');
  });

  it('accepts HTTP 200 when the provider sends no quota headers at all', async () => {
    const { impl } = stubFetch(() => envelope(OK_BODY));
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, diagnostics: false });

    const result = await client.get('fixtures', {});
    assert.equal(result.response?.length, 1, 'missing headers must never fail a request');
    assert.equal(client.rateLimit()?.dailyRemaining, null);
  });

  it('returns the data on the call that spends the last request, then refuses the next', async () => {
    // The response that empties the allowance was still paid for: its data is
    // returned. Only the following request — which the provider would reject —
    // is refused, and it is refused without a round trip.
    const { impl, calls } = stubFetch(() =>
      envelope(OK_BODY, {
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-requests-limit': '100',
          'x-ratelimit-requests-remaining': '0',
        },
      }),
    );
    const client = new ApiFootballClient({ apiKey: TEST_KEY, fetchImpl: impl, diagnostics: false });

    const first = await client.get('fixtures', {});
    assert.equal(first.response?.length, 1, 'data already paid for is not thrown away');
    assert.equal(calls.length, 1);

    await assert.rejects(
      () => client.get('fixtures', {}),
      (error: unknown) => {
        assert.ok(isSportsProviderError(error));
        assert.equal(error.code, 'RATE_LIMITED');
        assert.equal(error.retryable, true);
        return true;
      },
    );
    assert.equal(calls.length, 1, 'a request the provider would reject is not sent');
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

describe('low-cost fixture retrieval', () => {
  /** One day's slate across many competitions, as the date endpoint returns it. */
  function slate() {
    const entry = (fixtureId: number, leagueId: number, name: string) => ({
      fixture: {
        id: fixtureId,
        date: '2026-08-22T18:45:00+00:00',
        status: { short: 'NS', elapsed: null },
      },
      league: { id: leagueId, name, country: 'World', season: 2026 },
      teams: { home: { id: 10 + fixtureId, name: 'Home' }, away: { id: 20 + fixtureId, name: 'Away' } },
      goals: { home: null, away: null },
    });

    return {
      get: 'fixtures',
      errors: [],
      results: 4,
      response: [
        entry(1, 135, 'Serie A'),
        entry(2, 39, 'Premier League'),
        entry(3, 61, 'Ligue 1'),
        entry(4, 998, 'Some Regional Cup'),
      ],
    };
  }

  it('spends one request for the whole slate and filters competitions locally', async () => {
    const { impl, calls } = stubFetch(() => envelope(slate()));
    const provider = new ApiFootballProvider({
      apiKey: TEST_KEY,
      fetchImpl: impl,
      diagnostics: false,
    });

    const bundles = await provider.getFixtures({
      date: '2026-08-22',
      leagues: ['serie_a', 'premier_league', 'champions_league'],
    });

    assert.equal(calls.length, 1, 'the whole slate costs a single request');
    assert.equal(provider.usage().reduce((total, row) => total + row.requests, 0), 1);

    const url = new URL(calls[0]!.url);
    assert.equal(url.searchParams.get('date'), '2026-08-22');
    assert.equal(url.searchParams.get('league'), null, 'league must not be sent with date');
    assert.equal(
      url.searchParams.get('season'),
      null,
      'season alongside date is what the Free plan rejects',
    );

    assert.equal(bundles.length, 2, 'only the supported competitions are kept');
    assert.deepEqual(
      bundles.map((bundle) => bundle.fixture.id).sort(),
      ['af-1', 'af-2'],
    );
  });

  it('returns an empty list when the supported competitions are not playing', async () => {
    const { impl, calls } = stubFetch(() =>
      envelope({
        get: 'fixtures',
        errors: [],
        results: 1,
        response: [
          {
            fixture: { id: 9, date: '2026-08-22T18:45:00+00:00', status: { short: 'NS' } },
            league: { id: 61, name: 'Ligue 1', country: 'France', season: 2026 },
            teams: { home: { id: 1, name: 'A' }, away: { id: 2, name: 'B' } },
            goals: { home: null, away: null },
          },
        ],
      }),
    );
    const provider = new ApiFootballProvider({
      apiKey: TEST_KEY,
      fetchImpl: impl,
      diagnostics: false,
    });

    const bundles = await provider.getFixtures({ date: '2026-08-22' });

    assert.equal(calls.length, 1);
    assert.deepEqual(bundles, [], 'a day with no supported fixtures is a success with 0 fixtures');
  });

  it('falls back to one request per competition for a date range', async () => {
    // The range form of the endpoint requires league and season, so there is no
    // cheaper way to ask for it.
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

    const provider = new ApiFootballProvider({
      apiKey: TEST_KEY,
      fetchImpl: impl,
      diagnostics: false,
    });
    const bundles = await provider.getFixtures({
      from: '2026-08-22',
      to: '2026-08-24',
      leagues: ['serie_a', 'premier_league'],
    });

    assert.equal(calls.length, 2, 'one request per competition for a range');
    assert.equal(bundles.length, 2);
    assert.match(calls[0]!.url, /season=2026/);
  });
});
