import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

let cached: Stripe | null = null;

/**
 * Lazily constructed so a missing key fails on the request that needs it
 * rather than at build time.
 *
 * The API version is deliberately not pinned here: the SDK defaults to
 * the version its own types were generated against, so upgrading the
 * package upgrades both together. Pin it explicitly only when you are
 * ready to handle a version skew between the two.
 */
export function stripe(): Stripe {
  if (!cached) {
    cached = new Stripe(serverEnv.stripeSecretKey);
  }
  return cached;
}
