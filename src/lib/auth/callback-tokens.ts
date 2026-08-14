/**
 * Pure helpers for the Identity auth callback.
 *
 * `handleAuthCallback()` from `@netlify/identity` only reads `window.location.hash`,
 * and it is the only code path that both redeems the token *and* writes the
 * `nf_jwt` cookie the server needs to see the session. The standalone
 * `confirmEmail()` helper redeems the token without writing that cookie, so a
 * confirmation handled that way would log the user in on the client and still
 * fail every server render.
 *
 * These helpers therefore normalise whatever shape the link arrives in into a
 * hash fragment, so the single known-correct code path always runs.
 *
 * Kept free of browser globals so they can be unit tested directly.
 */

/** Hash parameters `handleAuthCallback()` recognises, in the order it checks them. */
export const AUTH_TOKEN_PARAMS = [
  'access_token',
  'confirmation_token',
  'recovery_token',
  'invite_token',
  'email_change_token',
] as const;

/**
 * GoTrue can also deliver `?token=<t>&type=<kind>` instead of a named hash
 * parameter, depending on how the Identity email template is written. Map each
 * kind onto the hash parameter that `handleAuthCallback()` looks for.
 */
const TYPE_TO_PARAM: Record<string, (typeof AUTH_TOKEN_PARAMS)[number]> = {
  signup: 'confirmation_token',
  confirmation: 'confirmation_token',
  recovery: 'recovery_token',
  invite: 'invite_token',
  email_change: 'email_change_token',
  emailchange: 'email_change_token',
};

/** True when the fragment already carries a token `handleAuthCallback()` accepts. */
export function hashHasAuthToken(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return AUTH_TOKEN_PARAMS.some((name) => Boolean(params.get(name)));
}

/**
 * Converts an auth callback delivered in the query string into the equivalent
 * hash fragment. Returns `null` when the query holds no auth token, so a normal
 * page load with unrelated query parameters is left alone.
 */
export function searchToAuthHash(search: string): string | null {
  const params = new URLSearchParams(search.replace(/^\?/, ''));

  for (const name of AUTH_TOKEN_PARAMS) {
    const value = params.get(name);
    if (value) return buildHash(name, value, params);
  }

  const generic = params.get('token');
  const kind = params.get('type')?.toLowerCase().replace(/[-_\s]/g, '');
  if (generic && kind) {
    const mapped = TYPE_TO_PARAM[kind] ?? TYPE_TO_PARAM[params.get('type') ?? ''];
    if (mapped) return buildHash(mapped, generic, params);
  }

  return null;
}

/**
 * OAuth needs its companion parameters carried across too, otherwise the
 * session is created without a refresh token and expires in an hour.
 */
function buildHash(
  name: (typeof AUTH_TOKEN_PARAMS)[number],
  value: string,
  source: URLSearchParams,
): string {
  const out = new URLSearchParams({ [name]: value });
  if (name === 'access_token') {
    for (const extra of ['refresh_token', 'token_type', 'expires_in', 'expires_at'] as const) {
      const carried = source.get(extra);
      if (carried) out.set(extra, carried);
    }
  }
  return out.toString();
}

/** The callback types that end with the user signed in and ready for the app. */
export type CallbackType = 'oauth' | 'confirmation' | 'recovery' | 'invite' | 'email_change';

/**
 * Fragment key the invite form reads the token back from.
 *
 * Deliberately *not* one of {@link AUTH_TOKEN_PARAMS}: the root-layout
 * forwarder redirects any recognised token to the callback route, so handing
 * the invite page back an `invite_token` fragment would bounce it straight to
 * the callback again and loop.
 */
export const INVITE_FRAGMENT_KEY = 'accept';

/**
 * Where each callback type should land.
 *
 * `recovery` leaves the user authenticated but without a password they chose,
 * so it must reach the password form rather than the dashboard. `invite` has no
 * session at all — only a token — so it needs the invite form.
 */
export function destinationForCallback(type: CallbackType, token?: string): string {
  switch (type) {
    case 'recovery':
      return '/update-password';
    case 'invite':
      return token
        ? `/accept-invite#${INVITE_FRAGMENT_KEY}=${encodeURIComponent(token)}`
        : '/login?error=authentication_failed';
    default:
      return '/dashboard';
  }
}

/**
 * Guards the `?next=` parameter against open redirects: only same-origin,
 * single-slash, non-protocol-relative paths are honoured.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('\\')) return fallback;
  if (/^\/+(?:[a-z][a-z0-9+.-]*:)/i.test(value)) return fallback;
  return value;
}
