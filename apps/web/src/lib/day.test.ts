import { describe, expect, it } from 'vitest';

import { formatDay, formatWeekday, isSameDay } from './day';

describe('formatDay', () => {
  it('writes the day as DD.MM.YYYY, from a timestamp or a date', () => {
    expect(formatDay('2026-09-30T12:00:00.000Z')).toBe('30.09.2026');
    expect(formatDay(new Date(2026, 8, 5, 12))).toBe('05.09.2026');
  });
});

describe('formatWeekday', () => {
  it('writes the weekday and the day the way the divider of the chat does', () => {
    expect(formatWeekday(new Date(2026, 8, 30, 12).toISOString())).toBe('Mittwoch, 30. September');
    expect(formatWeekday(new Date(2026, 0, 1, 0, 30).toISOString())).toBe('Donnerstag, 1. Januar');
  });
});

describe('isSameDay', () => {
  it('is true for two moments of one calendar day and false across midnight', () => {
    const late = new Date(2026, 8, 30, 23, 59).toISOString();
    expect(isSameDay(new Date(2026, 8, 30, 0, 1).toISOString(), late)).toBe(true);
    expect(isSameDay(late, new Date(2026, 9, 1, 0, 1).toISOString())).toBe(false);
  });
});
