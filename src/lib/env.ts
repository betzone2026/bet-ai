/**
 * Environment access. Public values are inlined by Next at build time and
 * must be referenced literally; server-only values are read lazily so a
 * missing key fails on the request that needs it, not at import time.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};

export const serverEnv = {
  get stripeSecretKey() {
    return required('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY);
  },
  get stripeWebhookSecret() {
    return required('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET);
  },
  get anthropicApiKey() {
    return required('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY);
  },
  priceIdFor(envKey: string): string {
    return required(envKey, process.env[envKey]);
  },
};
