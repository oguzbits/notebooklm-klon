import { z } from 'zod';

/** What a model call was made for. Every call is counted under one of these, per user. */
// The values must differ from those of every other dictionary (`pnpm audit:magic`).
export const USAGE_PURPOSE = {
  /** Answering a question, including the rewrite, the translation and the embedding of the question. */
  CHAT: 'CHAT_QUESTION',
  STUDIO: 'STUDIO_OUTPUT',
  /** The overview of a source and of a notebook. */
  OVERVIEW: 'OVERVIEW_SUMMARY',
  /** A model reading a PDF, an image, a recording or a video into text. */
  READ: 'SOURCE_READING',
  /** Embedding the passages of a new source. */
  EMBED: 'SOURCE_EMBEDDING',
} as const;

/** Which model role made the call: the three roles of `PROVIDER_LIMITS`. */
export const USAGE_ROLE = {
  PARSE: 'DOCUMENT_READER',
  CHAT: 'ANSWER_WRITER',
  EMBED: 'TEXT_EMBEDDER',
} as const;

export const UsagePurposeSchema = z.enum(USAGE_PURPOSE);
export const UsageRoleSchema = z.enum(USAGE_ROLE);

/** Whose call it is and what for: handed to every call that reaches a model. */
export const UsageScopeSchema = z.object({
  userId: z.string().min(1),
  purpose: UsagePurposeSchema,
});

/**
 * One model call as it is stored: counts only, never content. `estimated` is true where the
 * provider reported no count and the number is the server's own estimate.
 */
export const UsageEventSchema = UsageScopeSchema.extend({
  role: UsageRoleSchema,
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
});

export type UsagePurpose = z.infer<typeof UsagePurposeSchema>;
export type UsageRole = z.infer<typeof UsageRoleSchema>;
export type UsageScope = z.infer<typeof UsageScopeSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
