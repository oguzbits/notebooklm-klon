import { USAGE_PURPOSE, type UsageLimit, type UsageStatus } from '@nlm/shared';

import type { ChatInput } from '../ai/gemini-chat';
import { LIMITS } from '../config/limits';
import {
  DailyBudgetReachedError,
  RequestInProgressError,
  UsageLimitReachedError,
  windowUsage,
} from '../core/usage-limit';
import type { Database, UserScope } from '../db/client';
import { tokensSince, usageTimesSince } from '../db/usage-repository';

/** The two kinds of request that have a limit per user: answering a question, making a Studio output. */
type Limited = typeof USAGE_PURPOSE.CHAT | typeof USAGE_PURPOSE.STUDIO;

const LIMIT_OF: Record<Limited, number> = {
  [USAGE_PURPOSE.CHAT]: LIMITS.CHAT_QUESTIONS_PER_WINDOW,
  [USAGE_PURPOSE.STUDIO]: LIMITS.STUDIO_OUTPUTS_PER_WINDOW,
};

/**
 * Lets a request through only while the user is under the limit of the window, the demo is under its
 * budget and the user has no request of this kind running. The running ones are kept in memory, so
 * the check and the start of the call cannot overlap: that is right for one container, and the
 * limit must move into the database if there are ever several.
 */
export function createUsageGuard(
  inUser: UserScope,
  systemDb: Database,
  now: () => Date = () => new Date()
) {
  const running = new Set<string>();

  const windowStart = (at: Date) => new Date(at.getTime() - LIMITS.USAGE_WINDOW_MS);

  async function limitOf(userId: string, purpose: Limited, at: Date) {
    const since = windowStart(at);
    const times = await inUser(userId, (db) => usageTimesSince(db, userId, purpose, since));
    return windowUsage(times, LIMIT_OF[purpose], LIMITS.USAGE_WINDOW_MS, at);
  }

  async function budgetReached(at: Date) {
    return (await tokensSince(systemDb, windowStart(at))) >= LIMITS.DAILY_TOKEN_BUDGET;
  }

  async function assertBudget(): Promise<void> {
    if (await budgetReached(now())) throw new DailyBudgetReachedError();
  }

  return {
    /** For the calls that cost but are not limited per user: only the budget of the demo applies. */
    assertBudget,

    /** The model stream, but it refuses to start once the budget of the demo is used up. */
    budgeted(stream: (input: ChatInput) => AsyncIterable<string>) {
      return async function* (input: ChatInput): AsyncGenerator<string> {
        await assertBudget();
        yield* stream(input);
      };
    },

    /**
     * Throws when the request must not start. Otherwise the user holds a slot until `release` is
     * called, which must happen when the call is over, whatever its outcome.
     */
    async enter(userId: string, purpose: Limited): Promise<{ release: () => void }> {
      const key = `${purpose}:${userId}`;
      if (running.has(key)) throw new RequestInProgressError();
      running.add(key);
      try {
        await assertBudget();
        const usage = await limitOf(userId, purpose, now());
        if (usage.releaseAt) throw new UsageLimitReachedError(usage.releaseAt);
      } catch (error) {
        running.delete(key);
        throw error;
      }
      return { release: () => running.delete(key) };
    },

    async status(userId: string): Promise<UsageStatus> {
      const at = now();
      const asLimit = ({
        used,
        limit,
        releaseAt,
      }: Awaited<ReturnType<typeof limitOf>>): UsageLimit => ({
        used,
        limit,
        releaseAt: releaseAt?.toISOString() ?? null,
      });
      const [chat, studio, budget] = await Promise.all([
        limitOf(userId, USAGE_PURPOSE.CHAT, at),
        limitOf(userId, USAGE_PURPOSE.STUDIO, at),
        budgetReached(at),
      ]);
      return { chat: asLimit(chat), studio: asLimit(studio), budgetReached: budget };
    },
  };
}

export type UsageGuard = ReturnType<typeof createUsageGuard>;
