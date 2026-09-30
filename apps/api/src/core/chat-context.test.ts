import { describe, expect, it } from 'vitest';

import { buildChatContext, resolveCitations } from './chat-context';

const CHUNKS = [
  { id: 'uuid-1', text: 'Erster Abschnitt.' },
  { id: 'uuid-2', text: 'Zweiter Abschnitt.' },
];

describe('buildChatContext', () => {
  it('labels chunks c1, c2, ... in the order given and renders them for the prompt', () => {
    const context = buildChatContext(CHUNKS);

    expect(context.labels).toEqual(['c1', 'c2']);
    expect(context.promptText).toBe('[c1]\nErster Abschnitt.\n\n[c2]\nZweiter Abschnitt.');
  });

  it('returns an empty context for no chunks', () => {
    expect(buildChatContext([])).toEqual({ labels: [], promptText: '', idByLabel: new Map() });
  });

  it('maps every label back to its chunk ID', () => {
    expect(buildChatContext(CHUNKS).idByLabel).toEqual(
      new Map([
        ['c1', 'uuid-1'],
        ['c2', 'uuid-2'],
      ])
    );
  });
});

describe('resolveCitations', () => {
  it('replaces labels with chunk IDs and drops labels that were not in the context', () => {
    const context = buildChatContext(CHUNKS);
    const result = resolveCitations(
      {
        statements: [
          { text: 'Belegt.', chunkIds: ['c2', 'c9'] },
          { text: 'Nur erfunden.', chunkIds: ['c7'] },
        ],
      },
      context
    );

    expect(result.answer.statements).toEqual([{ text: 'Belegt.', chunkIds: ['uuid-2'] }]);
    expect(result.strippedCitations).toBe(2);
    expect(result.droppedStatements).toEqual(['Nur erfunden.']);
  });

  it('does not accept a real chunk ID that the model was never shown', () => {
    const result = resolveCitations(
      { statements: [{ text: 'Aussage.', chunkIds: ['uuid-1'] }] },
      buildChatContext(CHUNKS)
    );

    expect(result.answer.statements).toEqual([]);
    expect(result.strippedCitations).toBe(1);
  });
});
