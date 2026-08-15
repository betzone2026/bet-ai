/**
 * The Identity auth callback: token recognition, redemption, and where each
 * outcome lands.
 *
 * `handleAuthCallback()` from `@netlify/identity` only reads `window.location.hash`,
 * and it is the only code path that both redeems the token *and* writes the
 * `nf_jwt` cookie the server needs to see the session. The standalone
 * `confirmEmail()` helper redeems the token without writing that cookie, so a
 * confirmation handled that way would log the user in on the client and still
 * fail every server render. This module therefore normalises whatever shape the
 * link arrives in into a hash fragment, so the single known-correct code path
 * always runs — and owns the guard that makes sure it runs exactly once.
 *
 * Kept free of browser globals — they are injected — so all of it, including the
 * redemption guard, can be unit tested directly.
 */
import type { CallbackResult } from '@netlify/identity';

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
  return authTokenParam(hash) !== null;
}

/**
 * Which token parameter a fragment carries, or `null` for none.
 *
 * Returned in the same order `handleAuthCallback()` checks them, so this names
 * the token the SDK will actually act on when a fragment somehow carries more
 * than one. Exposed separately from {@link hashHasAuthToken} so the callback can
 * report *which kind* of token it saw without ever touching the value.
 */
export function authTokenParam(hash: string): (typeof AUTH_TOKEN_PARAMS)[number] | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return AUTH_TOKEN_PARAMS.find((name) => Boolean(params.get(name))) ?? null;
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

/* ---------------------------------------------------------------------------
 * Exactly-once redemption
 * ------------------------------------------------------------------------- */

/**
 * Identity tokens are single use. The moment one is redeemed the SDK clears the
 * fragment and the token is spent server-side, so a second attempt fails — and a
 * failure *after* a success reports a working confirmation as a broken one.
 * Every cause of a second attempt is real: React Strict Mode double-invokes
 * effects, an error boundary or Suspense retry remounts the component, and any
 * other handler mounted elsewhere in the tree races the first.
 *
 * A `useRef` guard only covers one component instance, so the real guard is the
 * module-level in-flight promise below. Every caller, from any component
 * instance, awaits the same single redemption and sees the same outcome.
 */

/** What the single redemption attempt concluded. */
export type RedemptionOutcome =
  /** The token was redeemed and a usable session exists. */
  | { status: 'redeemed'; type: CallbackType; destination: string }
  /** No auth token in the fragment. Not an error: an ordinary visit to the route. */
  | { status: 'absent' }
  /**
   * The fragment held a token but the SDK found none left to act on, so it had
   * already been redeemed and the fragment cleared. The session created by that
   * earlier redemption is the real one.
   */
  | { status: 'consumed' }
  /**
   * Redemption reported success but no session materialised. Treated as a
   * failure so the user is never sent to a private route that would bounce them
   * straight back out.
   */
  | { status: 'unverified' }
  /** The SDK rejected the token: already used, expired, or malformed. */
  | { status: 'failed'; message: string };

export interface RedemptionDeps {
  /** Current `window.location.hash`. */
  readHash: () => string;
  /** `handleAuthCallback` from `@netlify/identity`. The only redemption path. */
  redeem: () => Promise<CallbackResult | null>;
  /** Whether the `nf_jwt` cookie the server reads is now present. */
  hasSessionCookie: () => boolean;
  /** Diagnostics. Never receives a token, JWT or any other secret. */
  log?: (event: string, detail?: Record<string, string | boolean>) => void;
}

let inFlight: Promise<RedemptionOutcome> | null = null;

/**
 * Runs the redemption at most once per page load. Repeat calls — concurrent or
 * later — return the first attempt's result without touching the token again.
 */
export function redeemCallbackOnce(deps: RedemptionDeps): Promise<RedemptionOutcome> {
  inFlight ??= runRedemption(deps);
  return inFlight;
}

/** Clears the guard. Tests only; each case needs a fresh page-load state. */
export function resetRedemptionState(): void {
  inFlight = null;
}

async function runRedemption(deps: RedemptionDeps): Promise<RedemptionOutcome> {
  const log = deps.log ?? (() => {});

  // Read the fragment *before* redeeming: a successful `handleAuthCallback()`
  // clears it, so afterwards there is nothing left to report on.
  const detected = authTokenParam(deps.readHash());
  log('callback started', { tokenPresent: detected !== null, tokenType: detected ?? 'none' });

  if (!detected) return { status: 'absent' };

  let result: CallbackResult | null;
  try {
    log('handleAuthCallback started');
    result = await deps.redeem();
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown authentication error.';
    log('handleAuthCallback failure', { message });
    return { status: 'failed', message };
  }

  if (!result) {
    // The fragment carried a token a moment ago and the SDK saw none, so it was
    // spent between the two reads — another redemption got there first.
    log('handleAuthCallback success', { consumedElsewhere: true });
    return { status: 'consumed' };
  }

  const sessionCookie = deps.hasSessionCookie();
  log('handleAuthCallback success', {
    type: result.type,
    userAvailable: result.user !== null,
    sessionCookieDetected: sessionCookie,
  });

  if (!isSessionReady(result, sessionCookie)) return { status: 'unverified' };

  const destination = destinationForCallback(result.type, result.token);
  log('redirect destination', { destination });
  return { status: 'redeemed', type: result.type, destination };
}

/**
 * Whether the callback left behind something the rest of the app can actually
 * use.
 *
 * For every type that logs the user in that means both a resolved user and the
 * `nf_jwt` cookie: the client-side session alone is not enough, because the
 * server render of the destination reads the cookie and nothing else. An invite
 * is the exception by design — it yields a token and no session, because the
 * account does not exist until a password is set.
 */
function isSessionReady(result: CallbackResult, sessionCookie: boolean): boolean {
  if (result.type === 'invite') return Boolean(result.token);
  return result.user !== null && sessionCookie;
}
