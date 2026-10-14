import { USAGE_PURPOSE, type UsageSummary } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { formatUsageReport } from './usage-report';

const row = (overrides: Partial<UsageSummary>): UsageSummary => ({
  userId: 'a',
  purpose: USAGE_PURPOSE.CHAT,
  calls: 1,
  inputTokens: 100,
  outputTokens: 10,
  estimatedCalls: 0,
  ...overrides,
});

describe('formatUsageReport', () => {
  it('shows per purpose the calls, the average tokens per call and how many were estimated', () => {
    const report = formatUsageReport([
      row({ userId: 'a', calls: 2, inputTokens: 3000, outputTokens: 500, estimatedCalls: 1 }),
      row({ userId: 'b', calls: 2, inputTokens: 1000, outputTokens: 300 }),
    ]);

    // 4 calls, 4000 in / 800 out in total: 1000 in and 200 out on average.
    expect(report).toMatch(new RegExp(`${USAGE_PURPOSE.CHAT}\\s+4\\s+1000\\s+200\\s+1\\b`));
  });

  it('lists the users by their total tokens, the biggest first', () => {
    const report = formatUsageReport([
      row({ userId: 'small', inputTokens: 10, outputTokens: 1 }),
      row({ userId: 'big', purpose: USAGE_PURPOSE.STUDIO, inputTokens: 9000, outputTokens: 900 }),
      row({ userId: 'big', inputTokens: 1000, outputTokens: 100 }),
    ]);

    expect(report.indexOf('big')).toBeGreaterThan(-1);
    expect(report.indexOf('big')).toBeLessThan(report.indexOf('small'));
    // The two rows of "big" are one line with their sum: 11000 tokens.
    expect(report).toMatch(/big\s+2\s+11000/);
  });

  it('says so when there is nothing to report', () => {
    expect(formatUsageReport([])).toMatch(/no model calls/i);
  });
});
