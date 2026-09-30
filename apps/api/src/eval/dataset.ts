import { z } from 'zod';

/**
 * A golden question. `expectedAnchors` are literal passages of the source text that a correct
 * retrieval must surface. Anchors are text, not chunk IDs, because chunk IDs change whenever the
 * chunking changes. `requiredFacts` are literal strings a correct answer must contain; a list of strings
 * stands for one fact with equivalent spellings (46,2 and 46,185 Millionen), any of which counts.
 */
export const EvalQuestionSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  language: z.enum(['de', 'en']),
  expectedAnchors: z
    .array(z.object({ sourceFile: z.string().trim().min(1), text: z.string().trim().min(1) }))
    .min(1),
  requiredFacts: z
    .array(z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]))
    .default([]),
});

export const EvalDatasetSchema = z.array(EvalQuestionSchema).superRefine((questions, ctx) => {
  const seen = new Set<string>();
  questions.forEach((question, index) => {
    if (seen.has(question.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: `Duplicate question id "${question.id}"`,
      });
    }
    seen.add(question.id);
  });
});

export type EvalQuestion = z.infer<typeof EvalQuestionSchema>;
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;
