import { z } from 'zod';

import { ApiErrorCodeSchema } from './api-error';

const MAX_QUESTION_CHARS = 2000;

export const ChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_QUESTION_CHARS),
});

/** The events of a streamed answer, in the order they arrive. */
export const CHAT_EVENT = {
  /** One finished statement with the chunks that support it. */
  STATEMENT: 'ANSWER_STATEMENT',
  /** The answer is complete. */
  DONE: 'ANSWER_DONE',
  /** The answer failed. Statements that arrived before stay valid. */
  ERROR: 'ANSWER_ERROR',
} as const;

export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal(CHAT_EVENT.STATEMENT),
    text: z.string().min(1),
    /** Real chunk IDs, at least one: a statement without a citation is never sent. */
    chunkIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal(CHAT_EVENT.DONE),
    statements: z.number().int().nonnegative(),
    /** Statements the model wrote without a valid citation, left out of the answer. */
    droppedStatements: z.number().int().nonnegative(),
    /** Citations removed because the model cited a chunk it was not shown. */
    strippedCitations: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal(CHAT_EVENT.ERROR), code: ApiErrorCodeSchema }),
]);

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
