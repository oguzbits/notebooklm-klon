import { describe, expect, it } from 'vitest';

import { relativeTime } from './relative-time';

const NOW = new Date('2026-09-30T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe('relativeTime', () => {
  it('says "Gerade eben" for the first seconds', () => {
    expect(relativeTime(ago(10), NOW)).toBe('Gerade eben');
  });

  it('counts minutes, hours and days in short German', () => {
    expect(relativeTime(ago(60), NOW)).toBe('Vor 1 Min.');
    expect(relativeTime(ago(7 * 60), NOW)).toBe('Vor 7 Min.');
    expect(relativeTime(ago(3 * 3600), NOW)).toBe('Vor 3 Std.');
    expect(relativeTime(ago(2 * 86400), NOW)).toBe('Vor 2 Tagen');
  });

  it('falls back to the date after a week', () => {
    expect(relativeTime(ago(10 * 86400), NOW)).toBe('20.09.2026');
  });
});
