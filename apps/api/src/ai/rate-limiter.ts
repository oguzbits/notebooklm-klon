const WINDOW_MS = 60_000;
// Wake up a moment after the oldest entry leaves the window, so the check passes on the next turn.
const SLACK_MS = 50;

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

interface Entry {
  at: number;
  tokens: number;
}

/**
 * Keeps provider calls under the requests-per-minute and tokens-per-minute limits of a model by
 * sliding window. Calls start in the order they were made. A call that finishes with an error still
 * counts: the provider counted it too. Every LLM and embedding call goes through one of these.
 */
export class RateLimiter {
  private entries: Entry[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly limits: RateLimits,
    private readonly clock: Clock = systemClock
  ) {}

  async schedule<T>(estimatedTokens: number, task: () => Promise<T>): Promise<T> {
    if (estimatedTokens > this.limits.tokensPerMinute) {
      throw new RangeError(
        `A call of ${estimatedTokens} tokens can never fit into ${this.limits.tokensPerMinute} tokens per minute.`
      );
    }
    const turn = this.queue.then(() => this.acquire(estimatedTokens));
    // A failed acquire must not block the calls behind it.
    this.queue = turn.catch(() => undefined);
    await turn;
    return task();
  }

  private async acquire(tokens: number): Promise<void> {
    for (;;) {
      const now = this.clock.now();
      this.entries = this.entries.filter((entry) => now - entry.at < WINDOW_MS);
      const usedTokens = this.entries.reduce((sum, entry) => sum + entry.tokens, 0);
      const fitsRequests = this.entries.length < this.limits.requestsPerMinute;
      const fitsTokens = usedTokens + tokens <= this.limits.tokensPerMinute;
      if (fitsRequests && fitsTokens) {
        this.entries.push({ at: now, tokens });
        return;
      }
      const oldest = this.entries[0];
      const wait = oldest ? oldest.at + WINDOW_MS - now + SLACK_MS : SLACK_MS;
      await this.clock.sleep(Math.max(wait, SLACK_MS));
    }
  }
}
