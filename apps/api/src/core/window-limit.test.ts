import { describe, expect, it } from 'vitest';

import { createWindowLimit } from './window-limit';

const HOUR = 3_600_000;

describe('createWindowLimit', () => {
  it('lets a key through up to the maximum within the window, then refuses', () => {
    const now = 0;
    const limit = createWindowLimit({ max: 2, windowMs: HOUR, now: () => now });

    expect(limit.take('anna')).toBe(true);
    expect(limit.take('anna')).toBe(true);
    expect(limit.take('anna')).toBe(false);
  });

  it('counts every key on its own', () => {
    const limit = createWindowLimit({ max: 1, windowMs: HOUR, now: () => 0 });

    expect(limit.take('anna')).toBe(true);
    expect(limit.take('ben')).toBe(true);
    expect(limit.take('anna')).toBe(false);
  });

  it('lets a key through again once the old uses have left the window', () => {
    let now = 0;
    const limit = createWindowLimit({ max: 1, windowMs: HOUR, now: () => now });
    limit.take('anna');

    now = HOUR - 1;
    expect(limit.take('anna')).toBe(false);
    now = HOUR;
    expect(limit.take('anna')).toBe(true);
  });

  it('does not count a refused try', () => {
    let now = 0;
    const limit = createWindowLimit({ max: 1, windowMs: HOUR, now: () => now });
    limit.take('anna');
    now = HOUR / 2;
    limit.take('anna');
    limit.take('anna');

    now = HOUR;
    expect(limit.take('anna')).toBe(true);
  });

  it('can count everybody together with one fixed key', () => {
    const limit = createWindowLimit({ max: 2, windowMs: HOUR, now: () => 0 });

    expect(limit.take('all')).toBe(true);
    expect(limit.take('all')).toBe(true);
    expect(limit.take('all')).toBe(false);
  });
});
