import { z } from 'zod';

/** What a model call was made for. Every call is counted under one of these, per user. */
// The values must differ from those of every other dictionary (`pnpm audit:magic`).
export const USAGE_PURPOSE = {
  /** The answer to a question: one event per answer, which is what the limit per day counts. */
  CHAT: 'CHAT_QUESTION',
  /** Getting a question ready: the rewrite of a follow-up, the translation and the embedding. */
  QUESTION_PREP: 'QUESTION_PREPARATION',
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

/** What one user used for one purpose in a period: the input of the usage report. */
export const UsageSummarySchema = UsageScopeSchema.extend({
  calls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  /** Calls whose counts are the server's own estimate, not the provider's. */
  estimatedCalls: z.number().int().nonnegative(),
});

/** From this share of a limit used up, the UI tells the reader how much is left. */
export const USAGE_WARNING_RATIO = 0.75;

/** One limit as the reader sees it: what is used of it, and when the next slot frees up. */
export const UsageLimitSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  /** When one more use is possible again. Null while the limit is not reached. */
  releaseAt: z.iso.datetime().nullable(),
});

/** What `GET /api/usage` answers: the two limits per user and the budget of the whole demo. */
export const UsageStatusSchema = z.object({
  /** Questions in the chat. */
  chat: UsageLimitSchema,
  /** Outputs of the Studio. */
  studio: UsageLimitSchema,
  /** The daily budget of the demo for everybody is used up. */
  budgetReached: z.boolean(),
});

export type UsagePurpose = z.infer<typeof UsagePurposeSchema>;
export type UsageRole = z.infer<typeof UsageRoleSchema>;
export type UsageScope = z.infer<typeof UsageScopeSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
export type UsageLimit = z.infer<typeof UsageLimitSchema>;
export type UsageStatus = z.infer<typeof UsageStatusSchema>;
