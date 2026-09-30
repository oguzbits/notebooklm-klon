import { z } from 'zod';

/**
 * One statement of an answer and the chunks that support it. The model sees short labels per
 * request ("c1", "c2") and the server maps them to real chunk IDs, so the model never has to
 * reproduce an ID. The server keeps only IDs that were part of the context sent to the model.
 * Prompt, server and UI all use this schema.
 */
export const AnswerStatementSchema = z.object({
  text: z.string().trim().min(1),
  chunkIds: z.array(z.string().trim().min(1)),
});

export const AnswerSchema = z.object({
  statements: z.array(AnswerStatementSchema),
});

export type AnswerStatement = z.infer<typeof AnswerStatementSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
