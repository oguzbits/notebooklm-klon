import { describe, expect, it } from 'vitest';

import { sourcesLabel } from './sources-label';

describe('sourcesLabel', () => {
  it('says one source in the singular and every other number in the plural', () => {
    expect(sourcesLabel(0)).toBe('0 Quellen');
    expect(sourcesLabel(1)).toBe('1 Quelle');
    expect(sourcesLabel(2)).toBe('2 Quellen');
  });
});
