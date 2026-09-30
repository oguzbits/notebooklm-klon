import { describe, expect, it } from 'vitest';

import { numberCitations, splitAtHighlight } from './citations';

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

describe('splitAtHighlight', () => {
  it('splits the text into the part before, the highlight and the part after', () => {
    expect(splitAtHighlight('Vorher Treffer Nachher', 7, 14)).toEqual({
      before: 'Vorher ',
      highlight: 'Treffer',
      after: ' Nachher',
    });
  });

  it('keeps the whole text when there is no highlight', () => {
    expect(splitAtHighlight('Text', null, null)).toEqual({
      before: 'Text',
      highlight: '',
      after: '',
    });
  });

  it('clamps offsets that reach beyond the text', () => {
    expect(splitAtHighlight('Kurz', 2, 99)).toEqual({ before: 'Ku', highlight: 'rz', after: '' });
    expect(splitAtHighlight('Kurz', 50, 60)).toEqual({ before: 'Kurz', highlight: '', after: '' });
  });
});
