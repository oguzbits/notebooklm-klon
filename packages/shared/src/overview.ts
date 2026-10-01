import { z } from 'zod';

const MAX_TOPICS = 8;
const MAX_QUESTIONS = 4;

/**
 * What a source is about, generated once per source: a short summary, its key topics and questions
 * a reader could ask. The questions start the conversation, the summary sits in the source panel.
 */
export const SourceOverviewSchema = z.object({
  summary: z.string().trim().min(1),
  keyTopics: z.array(z.string().trim().min(1)).max(MAX_TOPICS),
  suggestedQuestions: z.array(z.string().trim().min(1)).max(MAX_QUESTIONS),
});

export type SourceOverview = z.infer<typeof SourceOverviewSchema>;

const MAX_EMOJI_CHARS = 16;
const MAX_SUMMARY_CHARS = 3000;
// Exactly one symbol: a pictograph, each part with an optional variation selector or skin tone,
// parts joined by zero-width joiners (👩‍🔬). Two symbols side by side do not match.
const ONE_EMOJI =
  /^\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier})?(?:\u200d\p{Extended_Pictographic}(?:\ufe0f|\p{Emoji_Modifier})?)*$/u;

/**
 * What the sources of a notebook are about together: one symbol that suits the topic and a short
 * summary in which the key terms are **bold**. It describes the sources and does not answer a
 * question from them, so it carries no citations (like the overview of a single source).
 */
export const NotebookOverviewSchema = z.object({
  emoji: z
    .string()
    .trim()
    .max(MAX_EMOJI_CHARS)
    // A refinement, not a pattern: the provider gets the plain string schema.
    .refine((text) => ONE_EMOJI.test(text), { message: 'One emoji.' }),
  summary: z.string().trim().min(1).max(MAX_SUMMARY_CHARS),
});

export type NotebookOverview = z.infer<typeof NotebookOverviewSchema>;

/** The answer of the overview endpoint: null while no source of the notebook is ready. */
export const NotebookOverviewResponseSchema = z.object({
  overview: NotebookOverviewSchema.nullable(),
});
