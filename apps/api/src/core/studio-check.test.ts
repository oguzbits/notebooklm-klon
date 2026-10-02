import { describe, expect, it } from 'vitest';

import { buildChatContext } from './chat-context';
import {
  checkDataTable,
  checked,
  checkFlashcards,
  checkMindmap,
  checkQuiz,
  checkReport,
} from './studio-check';

const context = buildChatContext([
  { id: 'id-1', text: 'Erste Passage.' },
  { id: 'id-2', text: 'Zweite Passage.' },
]);
const UNKNOWN = 'c9';

describe('checked', () => {
  it('swaps labels for chunk IDs once each and keeps the other fields', () => {
    const { kept, dropped } = checked([{ note: 'x', chunkIds: ['c2', 'c1', 'c2'] }], context);

    expect(kept).toEqual([{ note: 'x', chunkIds: ['id-2', 'id-1'] }]);
    expect(dropped).toBe(0);
  });

  it('ignores a label that was never shown but keeps the item for the labels that were', () => {
    const { kept } = checked([{ chunkIds: [UNKNOWN, 'c1'] }], context);

    expect(kept).toEqual([{ chunkIds: ['id-1'] }]);
  });

  it('drops an item without any valid citation and counts it', () => {
    const items = [{ chunkIds: [] }, { chunkIds: [UNKNOWN] }, { chunkIds: ['c1'] }];
    const { kept, dropped } = checked(items, context);

    expect(kept).toEqual([{ chunkIds: ['id-1'] }]);
    expect(dropped).toBe(2);
  });
});

describe('checkReport', () => {
  const statement = (text: string, ...chunkIds: string[]) => ({ text, chunkIds });

  it('drops unsupported statements, then every section that has none left', () => {
    const result = checkReport(
      {
        title: 'Bericht',
        sections: [
          { heading: 'Eins', statements: [statement('a', 'c1'), statement('b', UNKNOWN)] },
          { heading: 'Zwei', statements: [statement('c', UNKNOWN), statement('d')] },
        ],
      },
      context
    );

    expect(result).toEqual({
      content: {
        title: 'Bericht',
        sections: [{ heading: 'Eins', statements: [statement('a', 'id-1')] }],
      },
      dropped: 3,
      size: 1,
    });
  });
});

describe('checkFlashcards and checkQuiz', () => {
  it('keeps the cards with a valid citation and reports the rest', () => {
    const result = checkFlashcards(
      {
        cards: [
          { front: 'F1', back: 'B1', chunkIds: ['c1'] },
          { front: 'F2', back: 'B2', chunkIds: [UNKNOWN] },
        ],
      },
      context
    );

    expect(result).toEqual({
      content: { cards: [{ front: 'F1', back: 'B1', chunkIds: ['id-1'] }] },
      dropped: 1,
      size: 1,
    });
  });

  it('keeps the whole question, hint and reasons included, when its citation holds', () => {
    const question = {
      question: 'Wer?',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 2,
      explanation: 'Darum.',
      hint: 'Tipp',
      rationales: ['1', '2', '3', '4'],
    };
    const result = checkQuiz(
      {
        questions: [
          { ...question, chunkIds: ['c2'] },
          { ...question, chunkIds: [] },
        ],
      },
      context
    );

    expect(result).toEqual({
      content: { questions: [{ ...question, chunkIds: ['id-2'] }] },
      dropped: 1,
      size: 1,
    });
  });
});

describe('checkMindmap', () => {
  const leaf = (label: string, ...chunkIds: string[]) => ({ label, chunkIds });

  it('checks all three levels and counts what each level drops', () => {
    const result = checkMindmap(
      {
        title: 'Karte',
        branches: [
          {
            ...leaf('Ast', 'c1'),
            children: [
              {
                ...leaf('Zweig', 'c2'),
                children: [leaf('Blatt', 'c1'), leaf('Blatt ohne Beleg', UNKNOWN)],
              },
              { ...leaf('Zweig ohne Beleg', UNKNOWN), children: [leaf('Waise', 'c1')] },
            ],
          },
          { ...leaf('Ast ohne Beleg', UNKNOWN), children: [] },
        ],
      },
      context
    );

    expect(result).toEqual({
      content: {
        title: 'Karte',
        branches: [
          {
            ...leaf('Ast', 'id-1'),
            children: [{ ...leaf('Zweig', 'id-2'), children: [leaf('Blatt', 'id-1')] }],
          },
        ],
      },
      dropped: 3,
      size: 1,
    });
  });
});

describe('checkDataTable', () => {
  const cell = (text: string, ...chunkIds: string[]) => ({ text, chunkIds });
  const EMPTY = cell('');
  const table = (...rows: ReturnType<typeof cell>[][]) => ({
    title: 'Tabelle',
    columns: ['Name', 'Wert', 'Ort'],
    rows: rows.map((cells) => ({ cells })),
  });

  it('keeps a fully supported row with real chunk IDs', () => {
    const result = checkDataTable(
      table([cell('A', 'c1'), cell('1', 'c2'), cell('X', 'c1')]),
      context
    );

    expect(result).toEqual({
      content: {
        title: 'Tabelle',
        columns: ['Name', 'Wert', 'Ort'],
        rows: [{ cells: [cell('A', 'id-1'), cell('1', 'id-2'), cell('X', 'id-1')] }],
      },
      dropped: 0,
      size: 1,
    });
  });

  it('empties an unsupported cell, keeps the row and counts the cell', () => {
    const result = checkDataTable(
      table([cell('A', 'c1'), cell('1', UNKNOWN), cell('X', 'c2')]),
      context
    );

    expect(result.content.rows).toEqual([{ cells: [cell('A', 'id-1'), EMPTY, cell('X', 'id-2')] }]);
    expect(result.dropped).toBe(1);
  });

  it('clears the IDs of a cell without text and does not count it', () => {
    const result = checkDataTable(
      table([cell('A', 'c1'), cell('', 'c1'), cell('X', 'c2')]),
      context
    );

    expect(result.content.rows).toEqual([{ cells: [cell('A', 'id-1'), EMPTY, cell('X', 'id-2')] }]);
    expect(result.dropped).toBe(0);
  });

  it('drops a row whose first cell is not supported, however full the rest is', () => {
    const result = checkDataTable(
      table([cell('A', UNKNOWN), cell('1', 'c1'), cell('X', 'c2')]),
      context
    );

    expect(result).toMatchObject({ content: { rows: [] }, dropped: 1, size: 0 });
  });

  it('drops a row that would hold only one value', () => {
    const result = checkDataTable(table([cell('A', 'c1'), cell('1', UNKNOWN), EMPTY]), context);

    expect(result).toMatchObject({ content: { rows: [] }, dropped: 1, size: 0 });
  });

  it('drops a row with the wrong number of cells', () => {
    const result = checkDataTable(
      table(
        [cell('A', 'c1'), cell('1', 'c1')],
        [cell('B', 'c1'), cell('2', 'c1'), cell('Y', 'c1'), cell('Z', 'c1')]
      ),
      context
    );

    expect(result).toMatchObject({ content: { rows: [] }, dropped: 2, size: 0 });
  });
});
