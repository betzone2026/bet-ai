import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SESSION_COOKIE, cookieHeaderHasSession } from '../src/lib/auth/session-cookie.ts';

describe('cookieHeaderHasSession', () => {
  it('finds the session cookie on its own and among others', () => {
    assert.equal(cookieHeaderHasSession(`${SESSION_COOKIE}=abc`), true);
    assert.equal(cookieHeaderHasSession(`a=1; ${SESSION_COOKIE}=abc; b=2`), true);
    assert.equal(cookieHeaderHasSession(` ${SESSION_COOKIE}=abc `), true);
  });

  it('keeps a JWT intact even though it contains dots and dashes', () => {
    const jwt = 'eyJhbGciOi.eyJzdWIiOi-x_y.sig-nature_z';
    assert.equal(cookieHeaderHasSession(`${SESSION_COOKIE}=${jwt}`), true);
  });

  it('reports no session when the cookie is absent', () => {
    assert.equal(cookieHeaderHasSession(''), false);
    assert.equal(cookieHeaderHasSession('a=1; b=2'), false);
  });

  it('treats a cleared cookie as no session', () => {
    // Logout writes an empty value rather than removing the entry.
    assert.equal(cookieHeaderHasSession(`${SESSION_COOKIE}=`), false);
    assert.equal(cookieHeaderHasSession(`a=1; ${SESSION_COOKIE}=; b=2`), false);
  });

  it('does not mistake a differently named cookie for the session', () => {
    assert.equal(cookieHeaderHasSession(`not_${SESSION_COOKIE}=abc`), false);
    assert.equal(cookieHeaderHasSession(`${SESSION_COOKIE}_backup=abc`), false);
    assert.equal(cookieHeaderHasSession('nf_refresh=abc'), false);
  });
});
