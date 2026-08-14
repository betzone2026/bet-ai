/**
 * Resolves the one public origin the app is served from.
 *
 * Netlify Identity builds confirmation, recovery and invite links from its own
 * "Site URL" setting, and Stripe return URLs plus `metadataBase` are built from
 * this value. When nothing declares the real origin, every one of those falls
 * back to localhost or a deploy-assigned URL, which is how a confirmation link
 * ends up pointing somewhere other than the app. Resolving it here means the
 * value is inlined into both the server and client bundles at build time, so a
 * missing `NEXT_PUBLIC_SITE_URL` can no longer silently degrade to localhost in
 * production.
 *
 * Precedence: explicit override, then the Netlify-provided origin for the
 * current deploy context, then localhost for local development.
 */
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const production = process.env.URL;
  const preview = process.env.DEPLOY_PRIME_URL;
  const context = process.env.CONTEXT;

  // `netlify dev` reports CONTEXT=dev while still exposing the production URL.
  // Local requests belong on localhost, so do not adopt the production origin.
  const candidate =
    context === 'dev'
      ? 'http://localhost:3000'
      : (context === 'production' ? production : preview || production) ??
        'http://localhost:3000';

  // Normalise so callers can always concatenate a leading-slash path.
  return candidate.replace(/\/+$/, '');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SITE_URL: resolveSiteUrl(),
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
export default nextConfig;
