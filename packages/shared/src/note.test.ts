import { describe, expect, it } from 'vitest';

import {
  CreateNoteBodySchema,
  NOTE_KIND,
  NOTE_LIMITS,
  NoteListSchema,
  NoteSchema,
  NoteUpdateBodySchema,
} from './note';

const ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const OTHER_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

const answerNote = {
  id: ID,
  kind: NOTE_KIND.ANSWER,
  title: null,
  messageId: OTHER_ID,
  statements: [{ text: 'Dr. Brandt leitet es.', chunkIds: [OTHER_ID] }],
  createdAt: CREATED_AT,
};
const writtenNote = {
  id: ID,
  kind: NOTE_KIND.WRITTEN,
  title: 'Meine Gedanken',
  body: '# Idee\n\nEin **Absatz**.',
  createdAt: CREATED_AT,
};

describe('note contract', () => {
  it('parses a note with the statements and citations of an answer', () => {
    expect(NoteSchema.parse(answerNote)).toEqual(answerNote);
    expect(NoteListSchema.parse([answerNote, writtenNote])).toHaveLength(2);
  });

  it('allows a note whose answer was deleted, but not one without statements', () => {
    const orphan = { ...answerNote, messageId: null };

    expect(
      NoteSchema.safeParse({ ...orphan, statements: [{ text: 'A.', chunkIds: [] }] }).success
    ).toBe(true);
    expect(NoteSchema.safeParse({ ...orphan, statements: [] }).success).toBe(false);
  });

  it('parses a note the reader wrote, which has a text and no citations', () => {
    expect(NoteSchema.parse(writtenNote)).toEqual(writtenNote);
    expect(NoteSchema.parse({ ...writtenNote, body: '', title: null })).toMatchObject({ body: '' });
  });

  it('keeps the two kinds apart: a written note carries no statements and an answer no body', () => {
    expect(NoteSchema.safeParse({ ...writtenNote, body: undefined }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...answerNote, statements: undefined }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...answerNote, kind: 'OTHER' }).success).toBe(false);
    expect(NoteSchema.parse({ ...writtenNote, statements: [] })).not.toHaveProperty('statements');
  });

  it('limits the title and the text', () => {
    const longTitle = 'T'.repeat(NOTE_LIMITS.TITLE_CHARS + 1);
    const longBody = 'x'.repeat(NOTE_LIMITS.BODY_CHARS + 1);

    expect(NoteSchema.safeParse({ ...writtenNote, title: longTitle }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...writtenNote, title: '  ' }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...writtenNote, body: longBody }).success).toBe(false);
  });
});

describe('creating a note', () => {
  it('takes only the ID of the answer to save, never its content', () => {
    const body = { kind: NOTE_KIND.ANSWER, messageId: ID };

    expect(CreateNoteBodySchema.parse(body)).toEqual(body);
    expect(CreateNoteBodySchema.parse({ ...body, statements: [] })).toEqual(body);
    expect(CreateNoteBodySchema.safeParse({ ...body, messageId: 'x' }).success).toBe(false);
    expect(CreateNoteBodySchema.safeParse({ kind: NOTE_KIND.ANSWER }).success).toBe(false);
  });

  it('lets a note of the reader start with a title and a text, which carry no citations', () => {
    const body = { kind: NOTE_KIND.WRITTEN, title: 'Zusammenfassung', body: 'Ein **Text**.' };

    expect(CreateNoteBodySchema.parse({ ...body, title: '  Zusammenfassung ' })).toEqual(body);
    expect(CreateNoteBodySchema.parse({ ...body, statements: [] })).toEqual(body);
    expect(CreateNoteBodySchema.safeParse({ ...body, title: ' ' }).success).toBe(false);
    expect(
      CreateNoteBodySchema.safeParse({ ...body, body: 'x'.repeat(NOTE_LIMITS.BODY_CHARS + 1) })
        .success
    ).toBe(false);
  });
});

describe('changing a note', () => {
  it('takes a new title, a new text, or both', () => {
    expect(NoteUpdateBodySchema.parse({ title: '  Neu  ' })).toEqual({ title: 'Neu' });
    expect(NoteUpdateBodySchema.parse({ body: '' })).toEqual({ body: '' });
    expect(NoteUpdateBodySchema.parse({ title: 'A', body: 'B' })).toEqual({
      title: 'A',
      body: 'B',
    });
  });

  it('refuses an empty change, an empty title and anything too long', () => {
    expect(NoteUpdateBodySchema.safeParse({}).success).toBe(false);
    expect(NoteUpdateBodySchema.safeParse({ title: ' ' }).success).toBe(false);
    expect(
      NoteUpdateBodySchema.safeParse({ body: 'x'.repeat(NOTE_LIMITS.BODY_CHARS + 1) }).success
    ).toBe(false);
  });

  it('never takes statements, so a citation cannot be added by hand', () => {
    expect(NoteUpdateBodySchema.safeParse({ statements: [] }).success).toBe(false);
    expect(NoteUpdateBodySchema.parse({ title: 'A', statements: [] })).toEqual({ title: 'A' });
  });
});
