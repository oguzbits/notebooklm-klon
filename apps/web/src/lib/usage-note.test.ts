import { USAGE_WARNING_RATIO, type UsageLimit } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { BUDGET_NOTE, describeLimit, LIMIT_WORDS } from './usage-note';

const NOW = new Date('2026-10-14T10:00:00');
const limit = (used: number, releaseAt: string | null = null): UsageLimit => ({
  used,
  limit: 40,
  releaseAt,
});
const describe40 = (used: number, releaseAt: string | null = null, budgetReached = false) =>
  describeLimit({ limit: limit(used, releaseAt), budgetReached }, LIMIT_WORDS.CHAT, NOW);

describe('describeLimit', () => {
  it('says nothing before the warning threshold and leaves the input open', () => {
    const used = Math.floor(40 * USAGE_WARNING_RATIO) - 1;
    expect(describe40(used)).toEqual({ locked: false, note: null });
  });

  it('warns from the threshold on, with the number left', () => {
    expect(describe40(30)).toEqual({ locked: false, note: 'Noch 10 Fragen heute.' });
  });

  it('uses the singular for the last one', () => {
    expect(describe40(39).note).toBe('Noch 1 Frage heute.');
  });

  it('locks at the limit and names the time it works again', () => {
    const releaseAt = new Date('2026-10-14T15:00:00').toISOString();
    expect(describe40(40, releaseAt)).toEqual({
      locked: true,
      note: 'Das Limit ist erreicht. Ab 15:00 Uhr geht es wieder.',
    });
  });

  it('names tomorrow when the release is not on the same day', () => {
    const releaseAt = new Date('2026-10-15T03:30:00').toISOString();
    expect(describe40(40, releaseAt).note).toBe(
      'Das Limit ist erreicht. Ab morgen 03:30 Uhr geht es wieder.'
    );
  });

  it('locks for everybody when the budget of the demo is used up, whatever the personal count', () => {
    expect(describe40(0, null, true)).toEqual({ locked: true, note: BUDGET_NOTE });
  });

  it('says nothing while the status is not known', () => {
    expect(describeLimit(undefined, LIMIT_WORDS.CHAT, NOW)).toEqual({ locked: false, note: null });
  });
});
