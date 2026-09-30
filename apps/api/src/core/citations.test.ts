import { describe, expect, it } from 'vitest';

import { sanitizeAnswer } from './citations';

const CONTEXT = ['chunk-a', 'chunk-b', 'chunk-c'];

describe('sanitizeAnswer', () => {
  it('keeps statements whose citations are all part of the context', () => {
    const result = sanitizeAnswer(
      { statements: [{ text: 'Erste Aussage.', chunkIds: ['chunk-a', 'chunk-b'] }] },
      CONTEXT
    );

    expect(result.answer.statements).toEqual([
      { text: 'Erste Aussage.', chunkIds: ['chunk-a', 'chunk-b'] },
    ]);
    expect(result.strippedCitations).toBe(0);
    expect(result.droppedStatements).toEqual([]);
  });

  it('strips a citation that was not in the context and counts it', () => {
    const result = sanitizeAnswer(
      { statements: [{ text: 'Aussage.', chunkIds: ['chunk-a', 'invented'] }] },
      CONTEXT
    );

    expect(result.answer.statements).toEqual([{ text: 'Aussage.', chunkIds: ['chunk-a'] }]);
    expect(result.strippedCitations).toBe(1);
  });

  it('drops a statement that has no valid citation left and reports its text', () => {
    const result = sanitizeAnswer(
      {
        statements: [
          { text: 'Belegt.', chunkIds: ['chunk-c'] },
          { text: 'Erfunden.', chunkIds: ['invented'] },
          { text: 'Ohne Zitat.', chunkIds: [] },
        ],
      },
      CONTEXT
    );

    expect(result.answer.statements).toEqual([{ text: 'Belegt.', chunkIds: ['chunk-c'] }]);
    expect(result.droppedStatements).toEqual(['Erfunden.', 'Ohne Zitat.']);
    expect(result.strippedCitations).toBe(1);
  });

  it('removes duplicate citations inside one statement', () => {
    const result = sanitizeAnswer(
      { statements: [{ text: 'Aussage.', chunkIds: ['chunk-a', 'chunk-a'] }] },
      CONTEXT
    );

    expect(result.answer.statements[0]?.chunkIds).toEqual(['chunk-a']);
    expect(result.strippedCitations).toBe(0);
  });

  it('returns an empty answer when the context is empty', () => {
    const result = sanitizeAnswer(
      { statements: [{ text: 'Aussage.', chunkIds: ['chunk-a'] }] },
      []
    );

    expect(result.answer.statements).toEqual([]);
    expect(result.droppedStatements).toEqual(['Aussage.']);
  });
});
