import { describe, expect, it } from 'vitest';

import { formatDay } from './day';

describe('formatDay', () => {
  it('writes the day as DD.MM.YYYY, from a timestamp or a date', () => {
    expect(formatDay('2026-09-30T12:00:00.000Z')).toBe('30.09.2026');
    expect(formatDay(new Date(2026, 8, 5, 12))).toBe('05.09.2026');
  });
});
