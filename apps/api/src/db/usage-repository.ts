import type { UsageEvent, UsageSummary } from '@nlm/shared';
import { count, gte, lt, sql, sum } from 'drizzle-orm';

import type { Database } from './client';
import { usageEvents } from './schema';

/** Stores one model call. Counts only: nothing of the document or the question. */
export async function recordUsage(db: Database, event: UsageEvent): Promise<void> {
  await db.insert(usageEvents).values(event);
}

/** Deletes the events older than the cutoff. */
export async function deleteUsageBefore(db: Database, cutoff: Date): Promise<void> {
  await db.delete(usageEvents).where(lt(usageEvents.createdAt, cutoff));
}

/** Sums the events since `since` per user and purpose. Aggregated in the database. */
export async function summarizeUsage(db: Database, since: Date): Promise<UsageSummary[]> {
  const rows = await db
    .select({
      userId: usageEvents.userId,
      purpose: usageEvents.purpose,
      calls: count(),
      inputTokens: sum(usageEvents.inputTokens).mapWith(Number),
      outputTokens: sum(usageEvents.outputTokens).mapWith(Number),
      estimatedCalls: sql<number>`count(*) filter (where ${usageEvents.estimated})`.mapWith(Number),
    })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since))
    .groupBy(usageEvents.userId, usageEvents.purpose);
  return rows;
}
