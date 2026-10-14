import { USAGE_PURPOSE, USAGE_ROLE } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { user } from './auth-schema';
import { usageEvents } from './schema';
import { createTestDb } from './testing/test-db';
import {
  deleteUsageBefore,
  recordUsage,
  summarizeUsage,
  tokensSince,
  usageTimesSince,
} from './usage-repository';

const { db, pool } = createTestDb();
const DAY_MS = 24 * 60 * 60 * 1000;

const event = {
  userId: 'reader',
  purpose: USAGE_PURPOSE.CHAT,
  role: USAGE_ROLE.CHAT,
  inputTokens: 1200,
  outputTokens: 300,
  estimated: false,
};

beforeEach(async () => {
  await db.delete(user);
  await db.insert(user).values({
    id: 'reader',
    name: 'reader',
    email: 'reader@example.test',
  });
});

afterAll(async () => {
  await pool.end();
});

describe('recordUsage', () => {
  it('stores one row with the user, purpose, role and token counts', async () => {
    await recordUsage(db, event);

    const rows = await db.select().from(usageEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(event);
  });

  it('is gone with the user', async () => {
    await recordUsage(db, event);
    await db.delete(user).where(eq(user.id, 'reader'));

    expect(await db.select().from(usageEvents)).toHaveLength(0);
  });
});

describe('deleteUsageBefore', () => {
  it('deletes events older than the cutoff and keeps newer ones', async () => {
    await recordUsage(db, event);
    await db
      .insert(usageEvents)
      .values({ ...event, createdAt: new Date(Date.now() - 40 * DAY_MS) });

    await deleteUsageBefore(db, new Date(Date.now() - 30 * DAY_MS));

    const rows = await db.select().from(usageEvents);
    expect(rows).toHaveLength(1);
    expect(Date.now() - rows[0]!.createdAt.getTime()).toBeLessThan(DAY_MS);
  });
});

describe('summarizeUsage', () => {
  it('adds up the calls and tokens per user and purpose since the start of the period', async () => {
    await db.insert(user).values({ id: 'other', name: 'other', email: 'other@example.test' });
    await recordUsage(db, event);
    await recordUsage(db, { ...event, inputTokens: 800, outputTokens: 100, estimated: true });
    await recordUsage(db, { ...event, purpose: USAGE_PURPOSE.STUDIO });
    await recordUsage(db, { ...event, userId: 'other' });
    await db.insert(usageEvents).values({ ...event, createdAt: new Date(Date.now() - 3 * DAY_MS) });

    const rows = await summarizeUsage(db, new Date(Date.now() - DAY_MS));

    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual({
      userId: 'reader',
      purpose: USAGE_PURPOSE.CHAT,
      calls: 2,
      inputTokens: 2000,
      outputTokens: 400,
      estimatedCalls: 1,
    });
    expect(rows).toContainEqual(expect.objectContaining({ userId: 'other', calls: 1 }));
  });
});

describe('usageTimesSince', () => {
  it('lists the times of one purpose of one user inside the window, and nothing else', async () => {
    await db.insert(user).values({ id: 'other', name: 'other', email: 'other@example.test' });
    const recent = new Date(Date.now() - 1000);
    await db.insert(usageEvents).values({ ...event, createdAt: recent });
    await db.insert(usageEvents).values({ ...event, userId: 'other' });
    await db.insert(usageEvents).values({ ...event, purpose: USAGE_PURPOSE.STUDIO });
    await db.insert(usageEvents).values({ ...event, createdAt: new Date(Date.now() - 3 * DAY_MS) });

    const times = await usageTimesSince(
      db,
      'reader',
      USAGE_PURPOSE.CHAT,
      new Date(Date.now() - DAY_MS)
    );

    expect(times).toEqual([recent]);
  });
});

describe('tokensSince', () => {
  it('adds the input and output tokens of all users inside the window', async () => {
    await db.insert(user).values({ id: 'other', name: 'other', email: 'other@example.test' });
    await recordUsage(db, event);
    await recordUsage(db, { ...event, userId: 'other', inputTokens: 10, outputTokens: 5 });
    await db.insert(usageEvents).values({ ...event, createdAt: new Date(Date.now() - 3 * DAY_MS) });

    expect(await tokensSince(db, new Date(Date.now() - DAY_MS))).toBe(1200 + 300 + 15);
  });

  it('is 0 when nothing was used', async () => {
    expect(await tokensSince(db, new Date(Date.now() - DAY_MS))).toBe(0);
  });
});
