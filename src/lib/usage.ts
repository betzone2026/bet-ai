import { sql } from 'drizzle-orm';
import { db } from '@/../db';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function reserveUsage(
  userId: string,
  feature: string,
  limit: number,
): Promise<boolean> {
  const result = await db.execute(sql`
    insert into usage_logs (user_id, feature, usage_date, usage_count)
    values (${userId}, ${feature}, ${todayUtc()}, 1)
    on conflict (user_id, feature, usage_date)
    do update set usage_count = usage_logs.usage_count + 1
    where ${limit === Number.POSITIVE_INFINITY} or usage_logs.usage_count < ${limit}
    returning usage_count
  `);

  return result.rows.length === 1;
}

export async function releaseUsage(userId: string, feature: string): Promise<void> {
  await db.execute(sql`
    update usage_logs
    set usage_count = greatest(usage_count - 1, 0)
    where user_id = ${userId} and feature = ${feature} and usage_date = ${todayUtc()}
  `);
}

