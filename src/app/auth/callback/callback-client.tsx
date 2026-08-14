'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AuthError, getUser, handleAuthCallback } from '@netlify/identity';
import {
  destinationForCallback,
  hashHasAuthToken,
  searchToAuthHash,
} from '@/lib/auth/callback-tokens';

export function CallbackClient() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Identity tokens are single use and React Strict Mode double-invokes
    // effects, so an unguarded call redeems the token once successfully and
    // once with an already-spent token — reporting a working confirmation as
    // a failure.
    if (started.current) return;
    started.current = true;

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

      if (!hashHasAuthToken(window.location.hash)) {
        // Reached without a token at all. An existing session belongs in the
        // app; anyone else belongs at the login form. Neither is an error.
        const existing = await getUser();
        window.location.replace(existing ? '/dashboard' : '/login');
        return;
      }

      try {
        const result = await handleAuthCallback();
        if (!result) {
          window.location.replace('/login?error=authentication_failed');
          return;
        }
        // `replace` rather than `href` so the single-use token is not left in
        // session history, and a full navigation so the freshly written
        // `nf_jwt` cookie reaches the server render of the destination.
        window.location.replace(destinationForCallback(result.type, result.token));
      } catch (caught) {
        // Message only — the token and any stack trace stay out of the UI.
        console.error(
          '[auth] identity callback failed:',
          caught instanceof AuthError || caught instanceof Error
            ? caught.message
            : 'unknown error',
        );
        setFailed(true);
      }
    })();
  }, []);

  if (failed) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-lg border border-down/35 bg-down/[0.07] px-3 py-2 text-xs text-down"
        >
          We could not complete the confirmation.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Confirmation links can only be used once and expire after 24 hours. If you already
          confirmed this address, log in normally. Otherwise request a new link by signing up again
          with the same email.
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
