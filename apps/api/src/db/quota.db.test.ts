import { SOURCE_KIND } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { LIMITS } from '../config/limits';
import { QuotaExceededError } from '../ingestion/ingest';
import { createQuota } from './quota';
import { sources } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const assertCanCreate = createQuota(db);

async function addSources(userId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    await db
      .insert(sources)
      .values({ userId, contentHash: `${userId}-${index}`, kind: SOURCE_KIND.TXT, title: 't' });
  }
}

beforeEach(async () => {
  await pool.query('TRUNCATE sources, notebooks CASCADE');
  await ensureUsers(pool, ['user-a', 'user-b']);
});

afterAll(async () => {
  await pool.end();
});

describe('createQuota', () => {
  it('lets a user add sources until the limit is reached', async () => {
    await addSources('user-a', LIMITS.SOURCES_PER_USER_PER_WINDOW - 1);

    await expect(assertCanCreate('user-a')).resolves.toBeUndefined();
  });

  it('refuses the next new source once the limit is reached', async () => {
    await addSources('user-a', LIMITS.SOURCES_PER_USER_PER_WINDOW);

    await expect(assertCanCreate('user-a')).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("does not count another user's sources", async () => {
    await addSources('user-b', LIMITS.SOURCES_PER_USER_PER_WINDOW);

    await expect(assertCanCreate('user-a')).resolves.toBeUndefined();
  });
});
