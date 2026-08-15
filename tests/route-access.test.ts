import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  PROTECTED_PREFIXES,
  PUBLIC_PATHS,
  expectedMatcher,
  isProtectedPath,
} from '../src/lib/auth/route-access.ts';

const PROXY_SOURCE = new URL('../src/proxy.ts', import.meta.url);

/**
 * Reads the literal `config.matcher` out of the proxy source.
 *
 * The literal cannot be imported: `src/proxy.ts` pulls in `next/server`, and
 * Next.js requires the matcher to be statically analysable so it cannot be built
 * from a shared constant either. Parsing the source is what lets the test hold
 * the deployed value to account rather than a copy of it.
 */
async function declaredMatcher(): Promise<string[]> {
  const source = await readFile(PROXY_SOURCE, 'utf8');
  const block = /matcher:\s*\[([\s\S]*?)\]/.exec(source);
  const entries = block?.[1];
  assert.ok(entries, 'src/proxy.ts must declare config.matcher');
  return [...entries.matchAll(/'([^']+)'/g)].flatMap((m) => m[1] ?? []);
}

/** Turns a Next.js matcher entry into the paths it covers. */
function matches(entry: string, pathname: string): boolean {
  const pattern = entry.endsWith('/:path*')
    ? `^${entry.slice(0, -'/:path*'.length)}(?:/.*)?$`
    : `^${entry}$`;
  return new RegExp(pattern).test(pathname);
}

async function isGatedByProxy(pathname: string): Promise<boolean> {
  const matcher = await declaredMatcher();
  return matcher.some((entry) => matches(entry, pathname));
}

describe('the proxy matcher and the declared route list agree', () => {
  it('gates exactly the protected prefixes, and nothing else', async () => {
    assert.deepEqual(await declaredMatcher(), expectedMatcher());
  });
});

describe('public routes', () => {
  it('leaves the Identity callback ungated', async () => {
    // The callback runs before any session exists. Gating it would redirect to
    // /login while the single-use token in the fragment went unredeemed, so the
    // confirmation link would be spent for nothing.
    assert.equal(isProtectedPath('/auth/callback'), false);
    assert.equal(await isGatedByProxy('/auth/callback'), false);
  });

  it('leaves every declared public path reachable without a session', async () => {
    for (const path of PUBLIC_PATHS) {
      assert.equal(isProtectedPath(path), false, path);
      assert.equal(await isGatedByProxy(path), false, `${path} must not hit the proxy`);
    }
  });

  it('does not gate the page it redirects to, so there is no loop', async () => {
    // If /login were itself gated, an anonymous request would redirect to /login
    // forever.
    assert.equal(await isGatedByProxy('/login'), false);
    assert.equal(await isGatedByProxy('/'), false);
  });
});

describe('protected routes', () => {
  it('gates the dashboard against an anonymous request', async () => {
    assert.equal(isProtectedPath('/dashboard'), true);
    assert.equal(await isGatedByProxy('/dashboard'), true);
  });

  it('gates every protected prefix and its subpaths', async () => {
    for (const prefix of PROTECTED_PREFIXES) {
      assert.equal(isProtectedPath(prefix), true, prefix);
      assert.equal(isProtectedPath(`${prefix}/nested/deep`), true, `${prefix}/nested/deep`);
      assert.equal(await isGatedByProxy(prefix), true, prefix);
      assert.equal(await isGatedByProxy(`${prefix}/nested/deep`), true, `${prefix}/nested/deep`);
    }
  });

  it('does not gate a path that merely starts with the same characters', async () => {
    assert.equal(isProtectedPath('/dashboards'), false);
    assert.equal(await isGatedByProxy('/dashboard-public'), false);
  });
});
