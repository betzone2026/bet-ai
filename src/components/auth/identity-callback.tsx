'use client';

import { useEffect } from 'react';
import { hashHasAuthToken, searchToAuthHash } from '@/lib/auth/callback-tokens';

const CALLBACK_PATH = '/auth/callback';

/**
 * Mounted in the root layout so that an Identity callback is handled no matter
 * which page the email link points at.
 *
 * Netlify Identity builds confirmation and recovery links from its own "Site
 * URL" setting and appends the token as a fragment, so the link lands on the
 * site root rather than on a route this app chooses. Rather than redeeming the
 * token from whatever page that happens to be, this forwards the fragment
 * intact to {@link CALLBACK_PATH}, which owns the whole flow. That keeps the
 * outcome correct even if the Identity Site URL is later changed.
 *
 * The token is only ever moved between paths on the same origin — it is never
 * placed in a query string, so it stays out of server logs and `Referer`
 * headers.
 */
export function IdentityCallback() {
  useEffect(() => {
    // The callback route handles its own tokens; forwarding there would loop.
    if (window.location.pathname === CALLBACK_PATH) return;

    if (hashHasAuthToken(window.location.hash)) {
      window.location.replace(`${CALLBACK_PATH}${window.location.hash}`);
      return;
    }

    const promoted = searchToAuthHash(window.location.search);
    if (promoted) {
      window.location.replace(`${CALLBACK_PATH}#${promoted}`);
    }
  }, []);

  return null;
}
