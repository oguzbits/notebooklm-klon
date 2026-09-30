import { describe, expect, it } from 'vitest';

import { numberCitations } from './citations';

describe('numberCitations', () => {
  it('numbers each passage once, in the order it first appears', () => {
    const numbered = numberCitations([
      { text: 'Eins.', chunkIds: ['b', 'a'] },
      { text: 'Zwei.', chunkIds: ['a', 'c'] },
    ]);

    expect(numbered).toEqual([
      {
        text: 'Eins.',
        citations: [
          { chunkId: 'b', number: 1 },
          { chunkId: 'a', number: 2 },
        ],
      },
      {
        text: 'Zwei.',
        citations: [
          { chunkId: 'a', number: 2 },
          { chunkId: 'c', number: 3 },
        ],
      },
    ]);
  });

  it('shows a passage only once per statement', () => {
    const [statement] = numberCitations([{ text: 'Eins.', chunkIds: ['a', 'a'] }]);

    expect(statement?.citations).toEqual([{ chunkId: 'a', number: 1 }]);
  });

  it('returns nothing for an answer without statements', () => {
    expect(numberCitations([])).toEqual([]);
  });
});
