import { LIMITS } from '../config/limits';
import { QuotaExceededError } from '../ingestion/ingest';
import type { Database } from './client';
import { countSourcesSince } from './notebook-repository';

/** The quota check of the ingestion pipeline: new sources per user within a rolling window. */
export function createQuota(db: Database): (userId: string) => Promise<void> {
  return async (userId) => {
    const used = await countSourcesSince(db, userId, LIMITS.QUOTA_WINDOW_HOURS);
    if (used >= LIMITS.SOURCES_PER_USER_PER_WINDOW) throw new QuotaExceededError();
  };
}
