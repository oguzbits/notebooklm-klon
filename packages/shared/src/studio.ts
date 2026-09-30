import { z } from 'zod';

import { AnswerStatementSchema } from './citation';

/** What the Studio can make from the selected sources. */
export const STUDIO_KIND = {
  REPORT: 'REPORT',
  FLASHCARDS: 'FLASHCARDS',
  QUIZ: 'QUIZ',
  MINDMAP: 'MINDMAP',
} as const;

/** The shapes of a report. */
export const REPORT_FORMAT = {
  BRIEFING: 'BRIEFING',
  FAQ: 'FAQ',
  STUDY_GUIDE: 'STUDY_GUIDE',
} as const;

export const StudioKindSchema = z.enum(STUDIO_KIND);
export const ReportFormatSchema = z.enum(REPORT_FORMAT);

const QUIZ_OPTIONS = 4;
const text = z.string().trim().min(1);
/**
 * The model cites short labels ("c3"), the server replaces them by real chunk IDs and drops every
 * item that keeps no valid citation, like it does for chat answers. A stored output therefore has
 * only checked IDs.
 */
const chunkIds = z.array(z.string().trim().min(1));

export const ReportSchema = z.object({
  title: text,
  sections: z.array(z.object({ heading: text, statements: z.array(AnswerStatementSchema) })),
});

export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: text, back: text, chunkIds })),
});

export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question: text,
      options: z.array(text).length(QUIZ_OPTIONS),
      correctIndex: z
        .number()
        .int()
        .min(0)
        .max(QUIZ_OPTIONS - 1),
      explanation: text,
      chunkIds,
    })
  ),
});

// Three fixed levels instead of a recursive type: providers do not accept recursive schemas.
const leaf = z.object({ label: text, chunkIds });
const twig = leaf.extend({ children: z.array(leaf) });
export const MindmapSchema = z.object({
  title: text,
  branches: z.array(leaf.extend({ children: z.array(twig) })),
});

const outputBase = { id: z.uuid(), title: text, createdAt: z.iso.datetime() };

export const StudioOutputSchema = z.discriminatedUnion('kind', [
  z.object({
    ...outputBase,
    kind: z.literal(STUDIO_KIND.REPORT),
    format: ReportFormatSchema,
    content: ReportSchema,
  }),
  z.object({ ...outputBase, kind: z.literal(STUDIO_KIND.FLASHCARDS), content: FlashcardsSchema }),
  z.object({ ...outputBase, kind: z.literal(STUDIO_KIND.QUIZ), content: QuizSchema }),
  z.object({ ...outputBase, kind: z.literal(STUDIO_KIND.MINDMAP), content: MindmapSchema }),
]);

export const StudioOutputListSchema = z.array(StudioOutputSchema);

/** The request to make an output. Only a report has a format. */
export const CreateStudioBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(STUDIO_KIND.REPORT), format: ReportFormatSchema }),
  z.object({ kind: z.literal(STUDIO_KIND.FLASHCARDS) }),
  z.object({ kind: z.literal(STUDIO_KIND.QUIZ) }),
  z.object({ kind: z.literal(STUDIO_KIND.MINDMAP) }),
]);

export type StudioKind = z.infer<typeof StudioKindSchema>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Flashcards = z.infer<typeof FlashcardsSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Mindmap = z.infer<typeof MindmapSchema>;
export type StudioOutput = z.infer<typeof StudioOutputSchema>;
/** An output before it has an ID and a date, for every kind of output. */
export type NewStudioOutput = StudioOutput extends infer Output
  ? Output extends StudioOutput
    ? Omit<Output, 'id' | 'createdAt'>
    : never
  : never;
export type CreateStudioBody = z.infer<typeof CreateStudioBodySchema>;
