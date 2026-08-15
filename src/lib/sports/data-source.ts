/**
 * Chooses between real and demo data, and never mixes the two.
 *
 * The rule is deliberately simple and stated in one place: if the database
 * holds imported fixtures, the interface shows those; otherwise it shows the
 * clearly-labelled demo dataset. A screen is therefore entirely real or
 * entirely demonstrative, and always says which — a page showing three live
 * fixtures beside three invented ones would be worse than either.
 *
 * Server-only: it reads the database directly, and the demo dataset is only a
 * fallback, not a supplement.
 */

import { isDemoId } from './config.ts';
import { DEMO_MATCHES, getDemoMatch } from '@/lib/demo/matches';
import {
  getFixtureDetail,
  listFixtures,
  type FixtureDetail,
  type FixtureListItem,
  type FixtureListQuery,
} from './repository.ts';
import { isProviderConfigured } from './registry.ts';
import type { MatchView } from '@/lib/types/domain';

export type DataMode = 'REAL' | 'DEMO';

/** Why the interface fell back to demo data. Surfaced to the user verbatim. */
export type DemoReason = 'API_NOT_CONFIGURED' | 'NO_STORED_DATA' | 'DATABASE_UNAVAILABLE';

export const DEMO_REASON_COPY: Record<DemoReason, string> = {
  API_NOT_CONFIGURED:
    'No sports data provider is configured, so the sample dataset is shown instead of live fixtures.',
  NO_STORED_DATA:
    'No fixtures have been imported yet. The sample dataset is shown until the first sync completes.',
  DATABASE_UNAVAILABLE:
    'Stored fixtures could not be read, so the sample dataset is shown instead.',
};

export type FixtureFeed =
  | { mode: 'REAL'; fixtures: FixtureListItem[]; apiConfigured: boolean }
  | { mode: 'DEMO'; matches: MatchView[]; apiConfigured: boolean; reason: DemoReason };

/**
 * Fixtures for a list screen.
 *
 * An empty result while other fixtures exist stays in `REAL` mode: filtering
 * Serie A down to nothing should show "no fixtures", not silently produce
 * invented ones.
 */
export async function getFixtureFeed(query: FixtureListQuery = {}): Promise<FixtureFeed> {
  const apiConfigured = isProviderConfigured();

  try {
    const fixtures = await listFixtures(query);
    if (fixtures.length > 0) return { mode: 'REAL', fixtures, apiConfigured };

    // Nothing matched. Is the store empty, or was it just this window?
    const any = await listFixtures({ limit: 1 });
    if (any.length > 0) return { mode: 'REAL', fixtures: [], apiConfigured };

    return {
      mode: 'DEMO',
      matches: DEMO_MATCHES,
      apiConfigured,
      reason: apiConfigured ? 'NO_STORED_DATA' : 'API_NOT_CONFIGURED',
    };
  } catch {
    return {
      mode: 'DEMO',
      matches: DEMO_MATCHES,
      apiConfigured,
      reason: 'DATABASE_UNAVAILABLE',
    };
  }
}

export type FixtureDetailFeed =
  | { mode: 'REAL'; detail: FixtureDetail }
  | { mode: 'DEMO'; match: MatchView }
  | null;

/**
 * One fixture, resolved by id.
 *
 * Demo ids (`dm-…`) and imported ids (`af-…`) cannot collide, so the id alone
 * decides which store answers.
 */
export async function getFixtureDetailFeed(id: string): Promise<FixtureDetailFeed> {
  if (isDemoId(id)) {
    const match = getDemoMatch(id);
    return match ? { mode: 'DEMO', match } : null;
  }

  try {
    const detail = await getFixtureDetail(id);
    return detail ? { mode: 'REAL', detail } : null;
  } catch {
    return null;
  }
}
