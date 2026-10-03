import { z } from 'zod';

/**
 * A golden question. `expectedAnchors` are literal passages of the source text that a correct
 * retrieval must surface. Anchors are text, not chunk IDs, because chunk IDs change whenever the
 * chunking changes. `requiredFacts` are literal strings a correct answer must contain; a list of strings
 * stands for one fact with equivalent spellings (46,2 and 46,185 Millionen), any of which counts.
 *
 * A question the sources cannot answer (`answerable: false`) has no anchors and no facts: a correct
 * chat gives no statement for it. `sourceFiles` names the files it is asked against, and
 * `forbiddenFacts` are strings (a plausible wrong figure) that no answer may contain.
 */
const SourceFileSchema = z.string().trim().min(1);

export const EvalQuestionSchema = z
  .object({
    id: z.string().trim().min(1),
    question: z.string().trim().min(1),
    language: z.enum(['de', 'en']),
    answerable: z.boolean().default(true),
    expectedAnchors: z
      .array(z.object({ sourceFile: SourceFileSchema, text: z.string().trim().min(1) }))
      .default([]),
    requiredFacts: z
      .array(z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]))
      .default([]),
    sourceFiles: z.array(SourceFileSchema).default([]),
    forbiddenFacts: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((question, ctx) => {
    if (question.answerable && question.expectedAnchors.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedAnchors'],
        message: 'An answerable question needs at least one anchor',
      });
    }
    if (!question.answerable && question.sourceFiles.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceFiles'],
        message: 'An unanswerable question names the files it is asked against',
      });
    }
    if (
      !question.answerable &&
      (question.expectedAnchors.length > 0 || question.requiredFacts.length > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['answerable'],
        message: 'An unanswerable question has no anchors and no required facts',
      });
    }
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

/** The corpus files a question needs: where its anchors are, or the files it is asked against. */
export function questionSourceFiles(question: EvalQuestion): string[] {
  return question.answerable
    ? [...new Set(question.expectedAnchors.map((anchor) => anchor.sourceFile))]
    : question.sourceFiles;
}
