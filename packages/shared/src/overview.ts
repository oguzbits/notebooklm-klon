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
