import { describe, expect, it } from 'vitest';

import { AnswerSchema, AnswerStatementSchema } from './citation';

describe('citation contract', () => {
  it('parses an answer whose statements carry chunk IDs', () => {
    const answer = { statements: [{ text: 'Die Würde ist unantastbar.', chunkIds: ['c1', 'c2'] }] };

    expect(AnswerSchema.parse(answer)).toEqual(answer);
  });

  it('accepts a statement with an empty citation list, the server decides what to do with it', () => {
    expect(AnswerStatementSchema.safeParse({ text: 'Keine Antwort.', chunkIds: [] }).success).toBe(
      true
    );
  });

  it('rejects a statement without text', () => {
    expect(AnswerStatementSchema.safeParse({ text: '  ', chunkIds: ['c1'] }).success).toBe(false);
  });

  it('rejects an empty chunk ID', () => {
    expect(AnswerStatementSchema.safeParse({ text: 'Text.', chunkIds: [''] }).success).toBe(false);
  });
});
