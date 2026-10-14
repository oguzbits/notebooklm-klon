/** What a user has used of one limit, and when one more use is possible again (null: it is now). */
export interface WindowUsage {
  used: number;
  limit: number;
  releaseAt: Date | null;
}

/**
 * Counts the uses inside the sliding window that ends now. At the limit, the next use is possible
 * when enough of the oldest uses have left the window to get below it. A use exactly one window old
 * has left.
 */
export function windowUsage(
  times: readonly Date[],
  limit: number,
  windowMs: number,
  now: Date
): WindowUsage {
  const start = now.getTime() - windowMs;
  const inside = times.map((time) => time.getTime()).filter((time) => time > start);
  inside.sort((a, b) => a - b);
  const used = inside.length;
  const blocking = used >= limit ? inside[used - limit] : undefined;
  return { used, limit, releaseAt: blocking === undefined ? null : new Date(blocking + windowMs) };
}

/** A user used up a limit of the window: `releaseAt` is when one more use is possible again. */
export class UsageLimitReachedError extends Error {
  constructor(readonly releaseAt: Date) {
    super('The limit of the window is reached.');
    this.name = 'UsageLimitReachedError';
  }
}

/** All users together used up the token budget of the window. */
export class DailyBudgetReachedError extends Error {
  constructor() {
    super('The budget of the window is used up.');
    this.name = 'DailyBudgetReachedError';
  }
}

/** The user already has a request of this kind running. */
export class RequestInProgressError extends Error {
  constructor() {
    super('A request of this kind is already running.');
    this.name = 'RequestInProgressError';
  }
}
