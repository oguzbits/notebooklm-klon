import { describe, expect, it } from 'vitest';

import { CreateNoteBodySchema, NoteListSchema, NoteSchema } from './note';

const ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const OTHER_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

describe('note contract', () => {
  it('parses a note with the statements and citations of an answer', () => {
    const note = {
      id: ID,
      messageId: OTHER_ID,
      statements: [{ text: 'Dr. Brandt leitet es.', chunkIds: [OTHER_ID] }],
      createdAt: CREATED_AT,
    };

    expect(NoteSchema.parse(note)).toEqual(note);
    expect(NoteListSchema.parse([note])).toHaveLength(1);
  });

  it('allows a note whose answer was deleted, but not one without statements', () => {
    const note = { id: ID, messageId: null, statements: [], createdAt: CREATED_AT };

    expect(
      NoteSchema.safeParse({ ...note, statements: [{ text: 'A.', chunkIds: [] }] }).success
    ).toBe(true);
    expect(NoteSchema.safeParse(note).success).toBe(false);
  });

  it('takes only the ID of the answer to save, never its content', () => {
    expect(CreateNoteBodySchema.parse({ messageId: ID })).toEqual({ messageId: ID });
    expect(CreateNoteBodySchema.safeParse({ messageId: 'x' }).success).toBe(false);
    expect(CreateNoteBodySchema.parse({ messageId: ID, statements: [] })).toEqual({
      messageId: ID,
    });
  });
});
