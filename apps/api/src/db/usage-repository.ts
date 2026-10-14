import type { UsageEvent } from '@nlm/shared';
import { lt } from 'drizzle-orm';

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
