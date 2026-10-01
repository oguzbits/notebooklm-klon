import { afterEach, describe, expect, it, vi } from 'vitest';

import { shuffle } from './shuffle';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shuffle', () => {
  it('returns every item once, in a new list, and leaves the original alone', () => {
    const original = [1, 2, 3, 4, 5];

    const mixed = shuffle(original);

    expect(mixed).not.toBe(original);
    expect([...mixed].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  it('follows the random numbers (Fisher-Yates)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(shuffle(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });

  it('copes with an empty list and with one item', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['x'])).toEqual(['x']);
  });
});
