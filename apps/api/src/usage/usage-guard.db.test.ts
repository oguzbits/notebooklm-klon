import { USAGE_PURPOSE, USAGE_ROLE } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { LIMITS } from '../config/limits';
import {
  DailyBudgetReachedError,
  RequestInProgressError,
  UsageLimitReachedError,
} from '../core/usage-limit';
import { user } from '../db/auth-schema';
import { usageEvents } from '../db/schema';
import { createTestDb } from '../db/testing/test-db';
import { createUsageGuard } from './usage-guard';

const { db, pool } = createTestDb();
const HOUR_MS = 3_600_000;
const NOW = new Date('2026-10-14T12:00:00.000Z');
let guard = createUsageGuard(db, () => NOW);

const ago = (ms: number) => new Date(NOW.getTime() - ms);

async function use(
  userId: string,
  purpose: typeof USAGE_PURPOSE.CHAT | typeof USAGE_PURPOSE.STUDIO,
  count: number,
  overrides: { at?: Date; tokens?: number } = {}
) {
  await db.insert(usageEvents).values(
    Array.from({ length: count }, () => ({
      userId,
      purpose,
      role: USAGE_ROLE.CHAT,
      inputTokens: overrides.tokens ?? 100,
      outputTokens: 0,
      estimated: false,
      createdAt: overrides.at ?? ago(HOUR_MS),
    }))
  );
}

beforeEach(async () => {
  // A new guard per test: the running requests of a test must not block the next one.
  guard = createUsageGuard(db, () => NOW);
  await db.delete(user);
  await db.insert(user).values([
    { id: 'reader', name: 'reader', email: 'reader@example.test' },
    { id: 'other', name: 'other', email: 'other@example.test' },
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe('enter', () => {
  it('lets a question through one below the limit and rejects the next at the limit', async () => {
    await use('reader', USAGE_PURPOSE.CHAT, LIMITS.CHAT_QUESTIONS_PER_WINDOW - 1);
    (await guard.enter('reader', USAGE_PURPOSE.CHAT)).release();

    await use('reader', USAGE_PURPOSE.CHAT, 1);

    await expect(guard.enter('reader', USAGE_PURPOSE.CHAT)).rejects.toBeInstanceOf(
      UsageLimitReachedError
    );
  });

  it('tells when the oldest use leaves the window', async () => {
    await use('reader', USAGE_PURPOSE.STUDIO, LIMITS.STUDIO_OUTPUTS_PER_WINDOW - 1);
    await use('reader', USAGE_PURPOSE.STUDIO, 1, { at: ago(10 * HOUR_MS) });

    const error = await guard
      .enter('reader', USAGE_PURPOSE.STUDIO)
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      releaseAt: new Date(NOW.getTime() - 10 * HOUR_MS + LIMITS.USAGE_WINDOW_MS),
    });
  });

  it('counts each user and each purpose on their own', async () => {
    await use('reader', USAGE_PURPOSE.CHAT, LIMITS.CHAT_QUESTIONS_PER_WINDOW);

    (await guard.enter('other', USAGE_PURPOSE.CHAT)).release();
    (await guard.enter('reader', USAGE_PURPOSE.STUDIO)).release();
  });

  it('lets only one request of a kind run per user, until it is released', async () => {
    const first = await guard.enter('reader', USAGE_PURPOSE.CHAT);

    await expect(guard.enter('reader', USAGE_PURPOSE.CHAT)).rejects.toBeInstanceOf(
      RequestInProgressError
    );
    (await guard.enter('other', USAGE_PURPOSE.CHAT)).release();
    first.release();
    (await guard.enter('reader', USAGE_PURPOSE.CHAT)).release();
  });

  it('lets only one of two simultaneous requests through, also one below the limit', async () => {
    await use('reader', USAGE_PURPOSE.CHAT, LIMITS.CHAT_QUESTIONS_PER_WINDOW - 1);

    const results = await Promise.allSettled([
      guard.enter('reader', USAGE_PURPOSE.CHAT),
      guard.enter('reader', USAGE_PURPOSE.CHAT),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('does not keep the slot of a request that was rejected', async () => {
    await use('reader', USAGE_PURPOSE.CHAT, LIMITS.CHAT_QUESTIONS_PER_WINDOW);
    await guard.enter('reader', USAGE_PURPOSE.CHAT).catch(() => undefined);
    await db.delete(usageEvents);

    (await guard.enter('reader', USAGE_PURPOSE.CHAT)).release();
  });

  it('rejects everybody once the budget of the day is used up', async () => {
    await use('other', USAGE_PURPOSE.CHAT, 1, { tokens: LIMITS.DAILY_TOKEN_BUDGET });

    await expect(guard.enter('reader', USAGE_PURPOSE.CHAT)).rejects.toBeInstanceOf(
      DailyBudgetReachedError
    );
  });
});

describe('assertBudget', () => {
  it('passes below the budget and throws at it', async () => {
    await use('other', USAGE_PURPOSE.CHAT, 1, { tokens: LIMITS.DAILY_TOKEN_BUDGET - 1 });
    await guard.assertBudget();

    await use('other', USAGE_PURPOSE.CHAT, 1, { tokens: 1 });

    await expect(guard.assertBudget()).rejects.toBeInstanceOf(DailyBudgetReachedError);
  });
});

describe('budgeted', () => {
  const input = {
    system: 's',
    user: 'u',
    schema: {},
    usage: { userId: 'reader', purpose: USAGE_PURPOSE.OVERVIEW },
  };
  async function* model(): AsyncGenerator<string> {
    yield 'Antwort';
  }

  it('passes the stream through while the budget lasts', async () => {
    const pieces: string[] = [];
    for await (const piece of guard.budgeted(model)(input)) pieces.push(piece);

    expect(pieces).toEqual(['Antwort']);
  });

  it('refuses to start the model once the budget is used up', async () => {
    await use('other', USAGE_PURPOSE.CHAT, 1, { tokens: LIMITS.DAILY_TOKEN_BUDGET });
    let started = false;
    async function* watched(): AsyncGenerator<string> {
      started = true;
      yield 'x';
    }

    await expect(guard.budgeted(watched)(input).next()).rejects.toBeInstanceOf(
      DailyBudgetReachedError
    );
    expect(started).toBe(false);
  });
});

describe('status', () => {
  it('reports the use of both limits and whether the budget is gone', async () => {
    await use('reader', USAGE_PURPOSE.CHAT, 3);
    await use('reader', USAGE_PURPOSE.STUDIO, LIMITS.STUDIO_OUTPUTS_PER_WINDOW, {
      at: ago(5 * HOUR_MS),
    });

    expect(await guard.status('reader')).toEqual({
      chat: { used: 3, limit: LIMITS.CHAT_QUESTIONS_PER_WINDOW, releaseAt: null },
      studio: {
        used: LIMITS.STUDIO_OUTPUTS_PER_WINDOW,
        limit: LIMITS.STUDIO_OUTPUTS_PER_WINDOW,
        releaseAt: new Date(NOW.getTime() - 5 * HOUR_MS + LIMITS.USAGE_WINDOW_MS).toISOString(),
      },
      budgetReached: false,
    });
  });
});
