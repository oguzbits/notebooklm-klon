import { describe, expect, it } from 'vitest';

import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('returns every item once, in a new list, and leaves the original alone', () => {
    const original = [1, 2, 3, 4, 5];

    const mixed = shuffle(original);

    expect(mixed).not.toBe(original);
    expect([...mixed].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });
});
