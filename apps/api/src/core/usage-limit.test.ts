import { describe, expect, it } from 'vitest';

import { windowUsage } from './usage-limit';

const HOUR_MS = 3_600_000;
const WINDOW_MS = 24 * HOUR_MS;
const NOW = new Date('2026-10-14T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('windowUsage', () => {
  it('lets the use happen one below the limit and gives no release time', () => {
    const usage = windowUsage([ago(HOUR_MS), ago(2 * HOUR_MS)], 3, WINDOW_MS, NOW);

    expect(usage).toEqual({ used: 2, limit: 3, releaseAt: null });
  });

  it('blocks at the limit and frees the next use when the oldest one leaves the window', () => {
    const usage = windowUsage(
      [ago(HOUR_MS), ago(10 * HOUR_MS), ago(5 * HOUR_MS)],
      3,
      WINDOW_MS,
      NOW
    );

    expect(usage.used).toBe(3);
    expect(usage.releaseAt).toEqual(new Date(NOW.getTime() - 10 * HOUR_MS + WINDOW_MS));
  });

  it('does not count a use that left the window, not even one exactly at its edge', () => {
    const usage = windowUsage(
      [ago(WINDOW_MS), ago(WINDOW_MS + HOUR_MS), ago(HOUR_MS)],
      3,
      WINDOW_MS,
      NOW
    );

    expect(usage.used).toBe(1);
  });

  it('frees up when enough have left, if there are more uses than the limit', () => {
    // A lowered limit: 4 uses against a limit of 2 need three of them to leave before one is allowed.
    const usage = windowUsage(
      [ago(HOUR_MS), ago(2 * HOUR_MS), ago(3 * HOUR_MS), ago(4 * HOUR_MS)],
      2,
      WINDOW_MS,
      NOW
    );

    expect(usage.releaseAt).toEqual(new Date(NOW.getTime() - 2 * HOUR_MS + WINDOW_MS));
  });
});
