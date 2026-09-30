import { z } from 'zod';

import { AnswerStatementSchema } from './citation';

/**
 * A note saved from an answer. It keeps the statements with their citations, so the chips still
 * lead to the passages. The content is copied by the server from the saved answer, never sent by
 * the client, so a note cannot carry a citation the server did not check.
 */
export const NoteSchema = z.object({
  id: z.uuid(),
  /** The answer the note came from, null when that answer no longer exists. */
  messageId: z.uuid().nullable(),
  statements: z.array(AnswerStatementSchema).min(1),
  createdAt: z.iso.datetime(),
});

export const CreateNoteBodySchema = z.object({ messageId: z.uuid() });

export const NoteListSchema = z.array(NoteSchema);

export type Note = z.infer<typeof NoteSchema>;
