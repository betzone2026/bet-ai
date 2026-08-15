import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cookie written by `@netlify/identity` when a session is created, and the same
 * cookie the Netlify CDN reads to evaluate the role conditions in
 * `netlify.toml`.
 */
const SESSION_COOKIE = 'nf_jwt';

/**
 * First gate for private routes. (`proxy` is Next 16's name for what used to be
 * the `middleware` convention.)
 *
 * This is deliberately an *optimistic* check: it only asks whether a session
 * cookie is present, which is cheap enough to run at the edge on every request
 * and turns an anonymous hit on a private route into an immediate redirect
 * instead of a rendered shell. Authorisation stays with the app layout and the
 * route handlers, which resolve the real user through `getUser()` and are the
 * authoritative gate — a forged or expired cookie gets past here and is
 * rejected there.
 *
 * Authenticated users are intentionally *not* bounced away from `/login`. A
 * cookie that outlives its user (deleted account, revoked session) would
 * otherwise ping-pong between the login page and the dashboard.
 *
 * Kept free of shared application imports: this runs detached from the render
 * path and may be deployed to the CDN.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  // Preserve the intended destination so login can return the user to it.
  // Same-origin path only; `LoginForm` validates it again before navigating.
  login.searchParams.set('next', `${pathname}${search}`);

  return NextResponse.redirect(login);
}

export const config = {
  // Allow-list by omission: only these prefixes are gated, so every other route
  // — `/`, `/login`, `/register`, `/reset-password`, `/accept-invite` and above
  // all `/auth/callback` — is public and never sees this function.
  //
  // `/auth/callback` being public is what makes email confirmation work at all.
  // It runs before any session exists, so gating it would bounce the user to
  // `/login` while the single-use token in the fragment went unredeemed.
  //
  // Kept as a literal because Next.js requires a statically analysable matcher.
  // `PROTECTED_PREFIXES` in `src/lib/auth/route-access.ts` mirrors this list and
  // a test asserts the two are identical.
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/matches',
    '/matches/:path*',
    '/ai-analyst',
    '/ai-analyst/:path*',
    '/monte-carlo',
    '/monte-carlo/:path*',
    '/portfolio',
    '/portfolio/:path*',
    '/history',
    '/history/:path*',
    '/settings',
    '/settings/:path*',
    '/subscription',
    '/subscription/:path*',
    '/admin',
    '/admin/:path*',
  ],
};
