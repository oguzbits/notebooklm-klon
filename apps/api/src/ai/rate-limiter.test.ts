import { describe, expect, it } from 'vitest';

import { RateLimiter } from './rate-limiter';

/** A clock that only moves when the limiter sleeps. */
function fakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

const MINUTE = 60_000;

describe('RateLimiter', () => {
  it('runs calls immediately while the limits allow it', async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ requestsPerMinute: 3, tokensPerMinute: 1000 }, clock);

    await limiter.schedule(100, async () => 'a');
    await limiter.schedule(100, async () => 'b');

    expect(clock.sleeps).toEqual([]);
  });

  it('waits until the oldest request leaves the window when the request limit is reached', async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ requestsPerMinute: 2, tokensPerMinute: 1000 }, clock);
    await limiter.schedule(1, async () => undefined);
    clock.sleeps.length = 0;
    await clock.sleep(10_000);
    await limiter.schedule(1, async () => undefined);

    await limiter.schedule(1, async () => undefined);

    // the first request was at t=0, so the third may start at t=60s
    expect(clock.now()).toBeGreaterThanOrEqual(MINUTE);
    expect(clock.now()).toBeLessThan(MINUTE + 1000);
  });

  it('waits when the token budget of the minute is used up', async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ requestsPerMinute: 100, tokensPerMinute: 30_000 }, clock);
    await limiter.schedule(20_000, async () => undefined);

    await limiter.schedule(20_000, async () => undefined);

    expect(clock.now()).toBeGreaterThanOrEqual(MINUTE);
  });

  it('does not wait when tokens are freed by the passing of time', async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ requestsPerMinute: 100, tokensPerMinute: 30_000 }, clock);
    await limiter.schedule(20_000, async () => undefined);
    await clock.sleep(MINUTE + 1);
    clock.sleeps.length = 0;

    await limiter.schedule(20_000, async () => undefined);

    expect(clock.sleeps).toEqual([]);
  });

  it('rejects a call that could never fit into the token budget', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 10, tokensPerMinute: 1000 }, fakeClock());

    await expect(limiter.schedule(1001, async () => 'x')).rejects.toBeInstanceOf(RangeError);
  });

  it('returns the result of the task and passes its error on', async () => {
    const limiter = new RateLimiter({ requestsPerMinute: 10, tokensPerMinute: 1000 }, fakeClock());

    expect(await limiter.schedule(1, async () => 42)).toBe(42);
    await expect(
      limiter.schedule(1, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  it('starts waiting calls in the order they were made', async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ requestsPerMinute: 1, tokensPerMinute: 1000 }, clock);
    const order: string[] = [];

    await Promise.all(
      ['a', 'b', 'c'].map((name) =>
        limiter.schedule(1, async () => {
          order.push(name);
        })
      )
    );

    expect(order).toEqual(['a', 'b', 'c']);
  });
});
