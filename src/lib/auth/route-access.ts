/**
 * Which paths the edge gate protects, and which it must leave alone.
 *
 * The proxy's `config.matcher` has to be a statically analysable literal, so it
 * cannot import this list. Instead this module is the declared intent and a test
 * asserts the literal in `src/proxy.ts` matches it exactly, so the two cannot
 * drift apart in either direction.
 *
 * Pure and dependency-free: importable from tests without the Next.js runtime.
 */

/** Route prefixes that require a session. Each also covers its subpaths. */
export const PROTECTED_PREFIXES = [
  '/dashboard',
  '/matches',
  '/ai-analyst',
  '/monte-carlo',
  '/portfolio',
  '/history',
  '/settings',
  '/subscription',
  '/admin',
] as const;

/**
 * Paths that must stay reachable without a session.
 *
 * `/auth/callback` is the one that matters most: it is where the Identity token
 * is redeemed, and at the moment it loads there is by definition no session yet.
 * Gating it would redirect the user to `/login` *before* the token was ever
 * processed — the confirmation link would then be spent for nothing.
 *
 * The password and signup aliases are listed even though this app routes them
 * under different names, so that adding one later cannot quietly land it behind
 * the gate.
 */
export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/signup',
  '/auth/callback',
  '/auth/signout',
  '/forgot-password',
  '/reset-password',
  '/update-password',
  '/accept-invite',
  '/pricing',
  '/privacy',
  '/terms',
] as const;

/** Whether the edge gate should demand a session cookie for this path. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** The two matcher entries a protected prefix expands to: the path and its subtree. */
export function matcherEntriesFor(prefix: string): [string, string] {
  return [prefix, `${prefix}/:path*`];
}

/** The full matcher list `src/proxy.ts` is expected to declare, in order. */
export function expectedMatcher(): string[] {
  return PROTECTED_PREFIXES.flatMap(matcherEntriesFor);
}
