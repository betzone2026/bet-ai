/**
 * Provider request accounting.
 *
 * Feeds bill per request and stop answering at the plan ceiling, so the
 * pipeline keeps its own count rather than discovering the limit by hitting it.
 * One row per provider, endpoint and day: enough to answer "what have we spent
 * today?" on the admin screen and to reason about a quota before a sync starts.
 */

import { and, eq, sql, sum } from 'drizzle-orm';
import { db } from '@/../db';
import { sportsApiUsage } from '@/../db/schema';

function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Adds requests to today's counter.
 *
 * Never throws: losing a count is a reporting inaccuracy, while failing a sync
 * because the counter could not be written would be a real outage.
 */
export async function recordApiRequests(
  provider: string,
  counts: Array<{ endpoint: string; requests: number }>,
  at: Date = new Date(),
): Promise<void> {
  const day = utcDay(at);

  for (const { endpoint, requests } of counts) {
    if (requests <= 0) continue;
    try {
      await db
        .insert(sportsApiUsage)
        .values({
          id: `${provider}:${endpoint}:${day}`,
          provider,
          endpoint,
          usageDate: day,
          requests,
        })
        .onConflictDoUpdate({
          target: [sportsApiUsage.provider, sportsApiUsage.endpoint, sportsApiUsage.usageDate],
          set: {
            requests: sql`${sportsApiUsage.requests} + ${requests}`,
            updatedAt: new Date(),
          },
        });
    } catch {
      // Counting is best-effort; the sync itself already succeeded.
    }
  }
}

/** Total requests made to a provider today. */
export async function requestsToday(provider: string, at: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sum(sportsApiUsage.requests) })
    .from(sportsApiUsage)
    .where(and(eq(sportsApiUsage.provider, provider), eq(sportsApiUsage.usageDate, utcDay(at))));

  return Number(row?.total ?? 0);
}

/** Today's requests broken down by endpoint, most expensive first. */
export async function requestsTodayByEndpoint(
  provider: string,
  at: Date = new Date(),
): Promise<Array<{ endpoint: string; requests: number }>> {
  const rows = await db
    .select({ endpoint: sportsApiUsage.endpoint, requests: sportsApiUsage.requests })
    .from(sportsApiUsage)
    .where(and(eq(sportsApiUsage.provider, provider), eq(sportsApiUsage.usageDate, utcDay(at))));

  return rows.sort((a, b) => b.requests - a.requests);
}
