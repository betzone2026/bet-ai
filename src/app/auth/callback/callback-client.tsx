'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { getUser, handleAuthCallback } from '@netlify/identity';
import {
  hashHasAuthToken,
  redeemCallbackOnce,
  searchToAuthHash,
  type RedemptionOutcome,
} from '@/lib/auth/callback-tokens';
import { cookieHeaderHasSession } from '@/lib/auth/session-cookie';

/**
 * Diagnostic trail for the confirmation flow, readable from the browser console
 * of a real signup.
 *
 * Deliberately records only shapes and outcomes — whether a token was present,
 * which kind it was, whether a user and a session cookie came back. Token
 * values, JWTs and passwords never reach it.
 */
function log(event: string, detail?: Record<string, string | boolean>) {
  if (detail) console.info(`[auth] ${event}`, detail);
  else console.info(`[auth] ${event}`);
}

export function CallbackClient() {
  // Two layers, guarding two different things. This flag stops *this* component
  // from running the flow twice, which Strict Mode's double-invoked effect would
  // otherwise do. The singleton inside `redeemCallbackOnce` stops any *other*
  // caller from redeeming the same token. Only the second is load-bearing for
  // correctness; this one keeps the navigation and the logs to one pass.
  const handled = useRef(false);
  const [failure, setFailure] = useState<'rejected' | 'unverified' | null>(null);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    void (async () => {
      // Identity normally delivers the token in the fragment, but a customised
      // email template can put it in the query string. Promote it so the one
      // code path that also writes the `nf_jwt` cookie always runs.
      if (!hashHasAuthToken(window.location.hash)) {
        const promoted = searchToAuthHash(window.location.search);
        if (promoted) {
          window.history.replaceState(null, '', `${window.location.pathname}#${promoted}`);
        }
      }

      // Single redemption path. `handleAuthCallback()` is the only call that
      // both redeems the token *and* writes the `nf_jwt` cookie, so nothing here
      // may also call `confirmEmail()` — that would spend the same single-use
      // token a second time and produce a session the server cannot see.
      const outcome = await redeemCallbackOnce({
        readHash: () => window.location.hash,
        redeem: handleAuthCallback,
        hasSessionCookie: () => cookieHeaderHasSession(document.cookie),
        log,
      });

      await settle(outcome, setFailure);
    })();
  }, []);

  if (failure) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-lg border border-down/35 bg-down/[0.07] px-3 py-2 text-xs text-down"
        >
          {failure === 'unverified'
            ? 'Your address was confirmed, but we could not start a session.'
            : 'We could not complete the confirmation.'}
        </p>
        <p className="text-sm leading-relaxed text-muted">
          {failure === 'unverified'
            ? 'Your account is ready — log in with the email and password you just chose.'
            : 'Confirmation links can only be used once and expire after 24 hours. If you already confirmed this address, log in normally. Otherwise request a new link by signing up again with the same email.'}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/login" className="text-alpha hover:underline">
            Go to log in
          </Link>
          <Link href="/register" className="text-muted hover:text-ink">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span
        aria-hidden
        className="h-3.5 w-3.5 animate-spin rounded-full border border-line border-t-alpha"
      />
      Completing sign in…
    </div>
  );
}

/**
 * Turns the redemption outcome into a navigation, or into a message when there
 * is nothing to navigate to.
 *
 * Navigation always uses `location.replace`: a full load so the freshly written
 * `nf_jwt` cookie reaches the server render of the destination, and a *replace*
 * so the single-use token is not left behind in session history where the back
 * button would replay it.
 */
async function settle(
  outcome: RedemptionOutcome,
  setFailure: (value: 'rejected' | 'unverified') => void,
) {
  switch (outcome.status) {
    case 'redeemed':
      window.location.replace(outcome.destination);
      return;

    case 'absent':
    case 'consumed': {
      // Either an ordinary visit with no token, or a token this page already
      // redeemed. Both are answered the same way: by asking who is actually
      // logged in, rather than by assuming. A session found here is a
      // confirmation that worked, so it must not be reported as a failure.
      const user = await getUser();
      log('session check', { userAvailable: user !== null });
      log('redirect destination', { destination: user ? '/dashboard' : '/login' });
      window.location.replace(user ? '/dashboard' : '/login');
      return;
    }

    case 'unverified':
      // The token was accepted but no session cookie followed, so sending the
      // user to a private route would only bounce them back out with a
      // misleading "session expired". Say what happened instead.
      setFailure('unverified');
      return;

    case 'failed':
      setFailure('rejected');
  }
}
