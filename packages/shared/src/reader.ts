import { z } from 'zod';

import { FollowUpsSchema } from './chat';
import { AnswerStatementSchema } from './citation';
import { SourceKindSchema } from './source';

/** Who wrote a chat message. */
export const CHAT_ROLE = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
} as const;

const NonNegativeInt = z.number().int().nonnegative();

/**
 * A cited passage, for the hover popup and for the highlight in the reader. The offsets point into
 * the text of the source ({@link SourceTextSchema}).
 */
export const ChunkDetailSchema = z.object({
  id: z.uuid(),
  sourceId: z.uuid(),
  sourceTitle: z.string(),
  /** How the text is read: a plain text source keeps its line breaks, the others are Markdown. */
  sourceKind: SourceKindSchema,
  text: z.string(),
  startOffset: NonNegativeInt,
  endOffset: NonNegativeInt,
});

/** The extracted text of a source, shown in the reader. */
export const SourceTextSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  kind: SourceKindSchema,
  /** The address of a web page source, otherwise null. */
  sourceUrl: z.string().nullable(),
  text: z.string(),
});

const messageBase = { id: z.uuid(), createdAt: z.iso.datetime() };

export const ChatMessageSchema = z.discriminatedUnion('role', [
  z.object({ ...messageBase, role: z.literal(CHAT_ROLE.USER), text: z.string().min(1) }),
  z.object({
    ...messageBase,
    role: z.literal(CHAT_ROLE.ASSISTANT),
    /** Only statements the server checked: every chunk ID was part of the context. */
    statements: z.array(AnswerStatementSchema),
    /** What the reader could ask next. Answers from before this existed have none. */
    followUps: FollowUpsSchema.default([]),
  }),
]);

export const ChatMessageListSchema = z.array(ChatMessageSchema);

export type ChatRole = (typeof CHAT_ROLE)[keyof typeof CHAT_ROLE];
export type ChunkDetail = z.infer<typeof ChunkDetailSchema>;
export type SourceText = z.infer<typeof SourceTextSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
