import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTH_TOKEN_PARAMS,
  INVITE_FRAGMENT_KEY,
  destinationForCallback,
  hashHasAuthToken,
  safeNextPath,
  searchToAuthHash,
} from '../src/lib/auth/callback-tokens.ts';

describe('hashHasAuthToken', () => {
  it('recognises every token parameter the Identity SDK accepts', () => {
    for (const name of AUTH_TOKEN_PARAMS) {
      assert.equal(hashHasAuthToken(`#${name}=abc123`), true, name);
      assert.equal(hashHasAuthToken(`${name}=abc123`), true, `${name} without leading #`);
    }
  });

  it('ignores fragments that carry no token', () => {
    assert.equal(hashHasAuthToken(''), false);
    assert.equal(hashHasAuthToken('#'), false);
    assert.equal(hashHasAuthToken('#pricing'), false);
    assert.equal(hashHasAuthToken('#confirmation_token='), false, 'empty value is not a token');
  });
});

describe('searchToAuthHash', () => {
  it('promotes a named token from the query string into a fragment', () => {
    assert.equal(searchToAuthHash('?confirmation_token=abc'), 'confirmation_token=abc');
    assert.equal(searchToAuthHash('recovery_token=xyz'), 'recovery_token=xyz');
  });

  it('maps GoTrue token/type pairs onto the matching fragment parameter', () => {
    assert.equal(searchToAuthHash('?token=abc&type=signup'), 'confirmation_token=abc');
    assert.equal(searchToAuthHash('?token=abc&type=recovery'), 'recovery_token=abc');
    assert.equal(searchToAuthHash('?token=abc&type=invite'), 'invite_token=abc');
    assert.equal(searchToAuthHash('?token=abc&type=email_change'), 'email_change_token=abc');
    assert.equal(searchToAuthHash('?token=abc&type=emailChange'), 'email_change_token=abc');
  });

  it('leaves ordinary query strings alone', () => {
    assert.equal(searchToAuthHash(''), null);
    assert.equal(searchToAuthHash('?checkout=success'), null);
    assert.equal(searchToAuthHash('?token=abc'), null, 'a token with no type is ambiguous');
    assert.equal(searchToAuthHash('?token=abc&type=nonsense'), null);
  });

  it('carries the OAuth companion parameters so the session keeps a refresh token', () => {
    const hash = searchToAuthHash('?access_token=at&refresh_token=rt&expires_in=3600');
    assert.ok(hash);
    const params = new URLSearchParams(hash);
    assert.equal(params.get('access_token'), 'at');
    assert.equal(params.get('refresh_token'), 'rt');
    assert.equal(params.get('expires_in'), '3600');
  });

  it('produces a fragment the SDK will then recognise', () => {
    const hash = searchToAuthHash('?token=abc&type=signup');
    assert.ok(hash);
    assert.equal(hashHasAuthToken(hash), true);
  });
});

describe('destinationForCallback', () => {
  it('sends a confirmed or returning user to the dashboard', () => {
    assert.equal(destinationForCallback('confirmation'), '/dashboard');
    assert.equal(destinationForCallback('oauth'), '/dashboard');
    assert.equal(destinationForCallback('email_change'), '/dashboard');
  });

  it('sends a recovery callback to the password form, not the dashboard', () => {
    assert.equal(destinationForCallback('recovery'), '/update-password');
  });

  it('hands an invite token to the invite form', () => {
    assert.equal(
      destinationForCallback('invite', 'tok en'),
      `/accept-invite#${INVITE_FRAGMENT_KEY}=tok%20en`,
    );
  });

  it('treats an invite callback with no token as a failure', () => {
    assert.equal(destinationForCallback('invite'), '/login?error=authentication_failed');
  });

  it('does not hand back a fragment the root forwarder would redirect again', () => {
    // Regression guard: reusing `invite_token` here would bounce the invite page
    // back to the callback route on every load.
    const destination = destinationForCallback('invite', 'abc');
    const fragment = destination.slice(destination.indexOf('#'));
    assert.equal(hashHasAuthToken(fragment), false);
  });
});

describe('safeNextPath', () => {
  it('keeps same-origin paths', () => {
    assert.equal(safeNextPath('/matches'), '/matches');
    assert.equal(safeNextPath('/matches/abc?tab=value'), '/matches/abc?tab=value');
  });

  it('falls back when the value is missing', () => {
    assert.equal(safeNextPath(null), '/dashboard');
    assert.equal(safeNextPath(undefined), '/dashboard');
    assert.equal(safeNextPath(''), '/dashboard');
  });

  it('rejects anything that would leave the origin', () => {
    for (const hostile of [
      'https://evil.example',
      '//evil.example',
      '///evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/https://evil.example',
    ]) {
      assert.equal(safeNextPath(hostile), '/dashboard', hostile);
    }
  });
});
