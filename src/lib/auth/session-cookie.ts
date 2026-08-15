/**
 * The one cookie name the whole session depends on, plus a parser for it.
 *
 * `@netlify/identity` writes `nf_jwt` from the browser after any successful
 * auth flow, the Next.js server render reads it back to resolve the user, and
 * the Netlify CDN reads it to evaluate the role conditions in `netlify.toml`.
 * A session that exists only in `localStorage` is invisible to all three.
 *
 * Kept free of browser and server globals so both sides — and the tests — can
 * share one definition.
 */
export const SESSION_COOKIE = 'nf_jwt';

/**
 * Whether a `document.cookie` / `Cookie` header string carries a non-empty
 * session cookie.
 *
 * Matches on the exact name so a cookie that merely ends in `nf_jwt` cannot be
 * mistaken for the real one, and treats an empty value as absent because that is
 * how the cookie is cleared on logout.
 */
export function cookieHeaderHasSession(header: string): boolean {
  return header.split(';').some((part) => {
    const separator = part.indexOf('=');
    if (separator === -1) return false;
    return (
      part.slice(0, separator).trim() === SESSION_COOKIE &&
      part.slice(separator + 1).trim() !== ''
    );
  });
}
