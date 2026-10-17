import { describe, expect, it } from 'vitest';

import { createIpLimit } from './ip-limit';

const HOUR_MS = 60 * 60 * 1000;

describe('createIpLimit', () => {
  it('lets an address start the allowed number within the window and refuses the next', () => {
    const limit = createIpLimit(2, HOUR_MS);
    const now = new Date('2026-10-18T10:00:00Z');
    expect(limit('203.0.113.7', now)).toBe(true);
    expect(limit('203.0.113.7', now)).toBe(true);
    expect(limit('203.0.113.7', now)).toBe(false);
  });

  it('counts each address on its own', () => {
    const limit = createIpLimit(1, HOUR_MS);
    const now = new Date('2026-10-18T10:00:00Z');
    expect(limit('203.0.113.7', now)).toBe(true);
    expect(limit('203.0.113.8', now)).toBe(true);
  });

  it('allows the address again once the window has passed', () => {
    const limit = createIpLimit(1, HOUR_MS);
    const start = new Date('2026-10-18T10:00:00Z');
    limit('203.0.113.7', start);
    expect(limit('203.0.113.7', new Date(start.getTime() + HOUR_MS - 1))).toBe(false);
    expect(limit('203.0.113.7', new Date(start.getTime() + HOUR_MS))).toBe(true);
  });
});
