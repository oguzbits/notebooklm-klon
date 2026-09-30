import { describe, expect, it } from 'vitest';

import { notebookEmoji } from './notebook-emoji';

describe('notebookEmoji', () => {
  it('gives the same notebook the same symbol every time', () => {
    const id = '3f2b1c9e-8a4d-4f6e-9c1a-2b7d5e8f0a11';

    expect(notebookEmoji(id)).toBe(notebookEmoji(id));
  });

  it('uses more than one symbol across different notebooks', () => {
    const symbols = new Set(
      Array.from({ length: 40 }, (_, index) =>
        notebookEmoji(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)
      )
    );

    expect(symbols.size).toBeGreaterThan(3);
  });

  it('copes with an empty ID', () => {
    expect(notebookEmoji('')).toBeTruthy();
  });
});
