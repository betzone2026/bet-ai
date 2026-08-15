/**
 * Sync run bookkeeping.
 *
 * A run row is written *before* the provider is called and closed afterwards,
 * so a crash mid-import leaves a visible `running` row rather than no evidence
 * at all. This is the table the admin screen reads to answer "is the feed
 * working?" without anyone opening a log.
 */

import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsSyncRuns } from '@/../db/schema';
import { MAX_ERROR_SUMMARY_CHARS } from '../config.ts';
import { redact } from '../logging.ts';

export type SyncRunStatus = 'running' | 'completed' | 'partial' | 'failed';

export interface SyncRunCounts {
  recordsReceived: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  apiRequests: number;
}

export async function startSyncRun(input: {
  provider: string;
  syncType: string;
  params?: Record<string, unknown>;
  triggeredBy?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(sportsSyncRuns).values({
    id,
    provider: input.provider,
    syncType: input.syncType,
    status: 'running',
    params: input.params ?? {},
    triggeredBy: input.triggeredBy ?? null,
  });
  return id;
}

/**
 * Closes a run.
 *
 * Error text is redacted and truncated rather than stored whole: the point is
 * for an operator to recognise the failure, and an unbounded blob of provider
 * output would only make the table expensive to keep.
 */
export async function completeSyncRun(
  id: string,
  input: { status: SyncRunStatus; counts: SyncRunCounts; errors?: string[] },
): Promise<void> {
  const summary = input.errors?.length
    ? redact(input.errors.join(' | ')).slice(0, MAX_ERROR_SUMMARY_CHARS)
    : null;

  await db
    .update(sportsSyncRuns)
    .set({
      status: input.status,
      completedAt: new Date(),
      recordsReceived: input.counts.recordsReceived,
      recordsInserted: input.counts.recordsInserted,
      recordsUpdated: input.counts.recordsUpdated,
      recordsFailed: input.counts.recordsFailed,
      apiRequests: input.counts.apiRequests,
      errorSummary: summary,
    })
    .where(eq(sportsSyncRuns.id, id));
}

export type SyncRunRow = typeof sportsSyncRuns.$inferSelect;

export async function recentSyncRuns(limit = 10): Promise<SyncRunRow[]> {
  return db.select().from(sportsSyncRuns).orderBy(desc(sportsSyncRuns.startedAt)).limit(limit);
}

export async function lastSyncRun(status: SyncRunStatus): Promise<SyncRunRow | null> {
  const [row] = await db
    .select()
    .from(sportsSyncRuns)
    .where(eq(sportsSyncRuns.status, status))
    .orderBy(desc(sportsSyncRuns.startedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Whether an equivalent sync already succeeded inside the TTL.
 *
 * This is the guard that turns the TTL policy into request savings: if today's
 * fixtures were imported four minutes ago, the provider is not called at all.
 */
export async function hasRecentSuccess(
  provider: string,
  syncType: string,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - ttlSeconds * 1000);
  const [row] = await db
    .select({ id: sportsSyncRuns.id })
    .from(sportsSyncRuns)
    .where(
      and(
        eq(sportsSyncRuns.provider, provider),
        eq(sportsSyncRuns.syncType, syncType),
        eq(sportsSyncRuns.status, 'completed'),
        gte(sportsSyncRuns.startedAt, since),
      ),
    )
    .limit(1);

  return row !== undefined;
}
