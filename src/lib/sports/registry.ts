/**
 * Provider registry.
 *
 * The single place the application decides *which* feed it is talking to.
 * Services take a `SportsDataProvider`; they never construct one, so adding a
 * second provider is a change to this file and an adapter directory.
 */

import { DEFAULT_PROVIDER } from './config.ts';
import type { SportsDataProvider } from './provider.ts';
import { ApiFootballClient } from './providers/api-football/client.ts';
import { ApiFootballProvider } from './providers/api-football/provider.ts';

export type ProviderFactory = (options?: { onRequest?: (endpoint: string) => void }) => SportsDataProvider;

const FACTORIES: Record<string, ProviderFactory> = {
  'api-football': (options) => new ApiFootballProvider(new ApiFootballClient(options)),
};

export function availableProviders(): string[] {
  return Object.keys(FACTORIES);
}

/**
 * Builds a provider instance.
 *
 * Instances are deliberately per-call rather than shared: each one accumulates
 * its own request counts, which is exactly what a sync run wants to report.
 */
export function getProvider(
  name: string = DEFAULT_PROVIDER,
  options?: { onRequest?: (endpoint: string) => void },
): SportsDataProvider {
  const factory = FACTORIES[name];
  if (!factory) throw new Error(`Unknown sports data provider: ${name}`);
  return factory(options);
}

/**
 * Whether the default provider has credentials.
 *
 * Never throws. A missing key is a state the admin screen renders and the
 * dashboard routes around — it is not allowed to take the application down.
 */
export function isProviderConfigured(name: string = DEFAULT_PROVIDER): boolean {
  try {
    return getProvider(name).isConfigured();
  } catch {
    return false;
  }
}
