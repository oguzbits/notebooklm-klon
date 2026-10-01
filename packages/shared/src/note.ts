import { z } from 'zod';

import { AnswerStatementSchema } from './citation';

/**
 * Where a note comes from. An ANSWER note is a saved answer: its statements keep their citations
 * and cannot be edited, so a chip never vouches for text that changed. A WRITTEN note is the
 * reader's own text, which has no citations to keep.
 */
export const NOTE_KIND = { ANSWER: 'ANSWER', WRITTEN: 'WRITTEN' } as const;

export const NOTE_LIMITS = { TITLE_CHARS: 200, BODY_CHARS: 100_000 } as const;

const title = z.string().trim().min(1).max(NOTE_LIMITS.TITLE_CHARS);
const body = z.string().max(NOTE_LIMITS.BODY_CHARS);

/** What every note has. A title of null means the reader never named it. */
const noteBase = {
  id: z.uuid(),
  title: title.nullable(),
  createdAt: z.iso.datetime(),
};

/**
 * A note saved from an answer. The content is copied by the server from the saved answer, never
 * sent by the client, so a note cannot carry a citation the server did not check.
 */
const AnswerNoteSchema = z.object({
  ...noteBase,
  kind: z.literal(NOTE_KIND.ANSWER),
  /** The answer the note came from, null when that answer no longer exists. */
  messageId: z.uuid().nullable(),
  statements: z.array(AnswerStatementSchema).min(1),
});

/** A note the reader wrote: Markdown, edited in the Studio and saved as it is typed. */
const WrittenNoteSchema = z.object({
  ...noteBase,
  kind: z.literal(NOTE_KIND.WRITTEN),
  body,
});

export const NoteSchema = z.discriminatedUnion('kind', [AnswerNoteSchema, WrittenNoteSchema]);

export const NoteListSchema = z.array(NoteSchema);

/** A note is made from a saved answer (only its ID is sent), or by the reader, empty or with a text. */
export const CreateNoteBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(NOTE_KIND.ANSWER), messageId: z.uuid() }),
  // A note of the reader may start with a text (a saved summary): it has no citations to protect.
  z.object({ kind: z.literal(NOTE_KIND.WRITTEN), title: title.optional(), body: body.optional() }),
]);

/** What can change on a note: its title (any note) and its text (a written note only). */
export const NoteUpdateBodySchema = z
  .object({ title, body })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Nothing to change.' });

export type Note = z.infer<typeof NoteSchema>;
export type AnswerNote = z.infer<typeof AnswerNoteSchema>;
export type WrittenNote = z.infer<typeof WrittenNoteSchema>;
export type CreateNoteBody = z.infer<typeof CreateNoteBodySchema>;
export type NoteUpdateBody = z.infer<typeof NoteUpdateBodySchema>;
