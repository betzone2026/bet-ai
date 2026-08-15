/**
 * Quota bookkeeping across requests.
 *
 * The client knows what the provider said on the *last* response; this module
 * remembers it between processes, which is what the admin screen and the
 * pre-flight guard need. One row per provider — the numbers are a current
 * reading, not a history, and a history of quota counters would be noise.
 *
 * Nothing here throws. A quota table that is unreachable must not be able to
 * fail a sync that otherwise worked: an unknown quota is a legitimate answer.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsProviderQuota } from '@/../db/schema';
import { sportsLog } from './logging.ts';
import { LOW_QUOTA_THRESHOLD } from './providers/api-football/rate-limit.ts';
import type { ProviderResponseReport } from './provider.ts';

export type QuotaState = 'UNKNOWN' | 'OK' | 'LOW' | 'EXHAUSTED';

export interface ProviderQuota {
  provider: string;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  burstLimit: number | null;
  burstRemaining: number | null;
  /** HTTP status of the last response seen from this provider. */
  lastStatus: number | null;
  lastEndpoint: string | null;
  /** `SUCCESS`, or the error code the last call produced. */
  lastOutcome: string | null;
  lastMessage: string | null;
  lastResultCount: number | null;
  observedAt: Date | null;
}

const EMPTY_QUOTA = (provider: string): ProviderQuota => ({
  provider,
  dailyLimit: null,
  dailyRemaining: null,
  burstLimit: null,
  burstRemaining: null,
  lastStatus: null,
  lastEndpoint: null,
  lastOutcome: null,
  lastMessage: null,
  lastResultCount: null,
  observedAt: null,
});

/**
 * Stores what the latest response revealed.
 *
 * Counters are written only when the response actually carried them. A
 * plan-rejected answer arrives with no rate-limit headers at all, and letting
 * that blank out a good reading would leave the admin screen showing an unknown
 * quota seconds after it showed 99 of 100 — which is how an operator learns to
 * distrust the screen.
 */
export async function recordQuotaObservation(
  provider: string,
  report: ProviderResponseReport,
): Promise<void> {
  const observedAt = report.observedAt ?? new Date();
  const counters = {
    ...(report.snapshot.dailyLimit !== null ? { dailyLimit: report.snapshot.dailyLimit } : {}),
    ...(report.snapshot.dailyRemaining !== null
      ? { dailyRemaining: report.snapshot.dailyRemaining }
      : {}),
    ...(report.snapshot.burstLimit !== null ? { burstLimit: report.snapshot.burstLimit } : {}),
    ...(report.snapshot.burstRemaining !== null
      ? { burstRemaining: report.snapshot.burstRemaining }
      : {}),
  };

  const observation = {
    lastStatus: report.status,
    lastEndpoint: report.endpoint,
    lastOutcome: report.outcome,
    lastMessage: report.message ? report.message.slice(0, 500) : null,
    lastResultCount: report.resultCount,
    observedAt,
  };

  try {
    await db
      .insert(sportsProviderQuota)
      .values({ provider, ...counters, ...observation })
      .onConflictDoUpdate({
        target: sportsProviderQuota.provider,
        set: { ...counters, ...observation },
      });
  } catch {
    // Diagnostics must never break the thing they diagnose.
    sportsLog.warn('quota observation could not be stored');
  }
}

/** Latest known quota for a provider, or an all-unknown reading. */
export async function readProviderQuota(provider: string): Promise<ProviderQuota> {
  try {
    const [row] = await db
      .select()
      .from(sportsProviderQuota)
      .where(eq(sportsProviderQuota.provider, provider))
      .limit(1);

    if (!row) return EMPTY_QUOTA(provider);

    return {
      provider: row.provider,
      dailyLimit: row.dailyLimit,
      dailyRemaining: row.dailyRemaining,
      burstLimit: row.burstLimit,
      burstRemaining: row.burstRemaining,
      lastStatus: row.lastStatus,
      lastEndpoint: row.lastEndpoint,
      lastOutcome: row.lastOutcome,
      lastMessage: row.lastMessage,
      lastResultCount: row.lastResultCount,
      observedAt: row.observedAt,
    };
  } catch {
    return EMPTY_QUOTA(provider);
  }
}

/**
 * Grades a reading for the admin screen.
 *
 * `UNKNOWN` is its own answer and must not be collapsed into `EXHAUSTED`:
 * having never measured the allowance is not the same as having spent it, and
 * conflating them disables Sync now on a perfectly usable key.
 */
export function quotaState(quota: ProviderQuota | null): QuotaState {
  if (!quota || quota.dailyRemaining === null) return 'UNKNOWN';
  if (quota.dailyRemaining <= 0) return 'EXHAUSTED';
  if (quota.dailyRemaining <= LOW_QUOTA_THRESHOLD) return 'LOW';
  return 'OK';
}

/**
 * Whether a sync may be attempted.
 *
 * Only a measured zero blocks it. An unknown quota is allowed through — the
 * request itself is how the allowance gets measured in the first place.
 */
export function canSpendQuota(quota: ProviderQuota | null): boolean {
  return quotaState(quota) !== 'EXHAUSTED';
}
