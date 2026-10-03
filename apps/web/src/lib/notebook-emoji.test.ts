import { describe, expect, it } from 'vitest';

import { notebookEmoji } from './notebook-emoji';

describe('notebookEmoji', () => {
  it('uses more than one symbol across different notebooks', () => {
    const symbols = new Set(
      Array.from({ length: 40 }, (_, index) =>
        notebookEmoji(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)
      )
    );

    expect(symbols.size).toBeGreaterThan(3);
  });
});
