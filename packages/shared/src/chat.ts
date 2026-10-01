import { z } from 'zod';

import { ApiErrorCodeSchema } from './api-error';
import { AnswerSchema } from './citation';

const MAX_QUESTION_CHARS = 2000;

/** How many questions the assistant suggests after an answer, like the three cards of NotebookLM. */
export const MAX_FOLLOW_UPS = 3;

/** Short questions the reader could ask next. They are no claims, so they carry no citation. */
export const FollowUpsSchema = z.array(z.string().trim().min(1)).max(MAX_FOLLOW_UPS);

/**
 * What the model returns for a question: the cited statements (the citation contract) and the
 * questions that could follow. Statements come first, so they can be shown while the rest is written.
 */
export const ChatReplySchema = AnswerSchema.extend({ followUps: FollowUpsSchema });

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
    /** Questions the reader could ask next, at most {@link MAX_FOLLOW_UPS}, maybe none. */
    followUps: FollowUpsSchema,
  }),
  z.object({ type: z.literal(CHAT_EVENT.ERROR), code: ApiErrorCodeSchema }),
]);

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatEvent = z.infer<typeof ChatEventSchema>;
