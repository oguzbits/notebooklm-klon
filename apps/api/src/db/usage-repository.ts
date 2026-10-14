import type { UsageEvent, UsagePurpose, UsageSummary } from '@nlm/shared';
import { and, count, eq, gte, lt, sql, sum } from 'drizzle-orm';

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

/** When a user used a purpose since `since`. The limit per day counts these. */
export async function usageTimesSince(
  db: Database,
  userId: string,
  purpose: UsagePurpose,
  since: Date
): Promise<Date[]> {
  const rows = await db
    .select({ createdAt: usageEvents.createdAt })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.purpose, purpose),
        gte(usageEvents.createdAt, since)
      )
    );
  return rows.map((row) => row.createdAt);
}

/** The tokens all users together used since `since`: the budget of the demo counts these. */
export async function tokensSince(db: Database, since: Date): Promise<number> {
  const [row] = await db
    .select({
      tokens:
        sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)`.mapWith(
          Number
        ),
    })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since));
  return row?.tokens ?? 0;
}
