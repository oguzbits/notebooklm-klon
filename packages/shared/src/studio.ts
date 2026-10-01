import { z } from 'zod';

import { AnswerStatementSchema } from './citation';

/** What the Studio can make from the selected sources. */
export const STUDIO_KIND = {
  REPORT: 'REPORT',
  FLASHCARDS: 'FLASHCARDS',
  QUIZ: 'QUIZ',
  MINDMAP: 'MINDMAP',
  DATA_TABLE: 'DATA_TABLE',
} as const;

/** The templates of a report. CUSTOM is an instruction the reader writes. */
export const REPORT_FORMAT = {
  BRIEFING: 'BRIEFING',
  FAQ: 'FAQ',
  STUDY_GUIDE: 'STUDY_GUIDE',
  BLOG: 'BLOG',
  CUSTOM: 'OWN_PROMPT',
} as const;

/** How many cards or questions: fewer, the usual number, more. */
// The values must differ from those of every other dictionary (`pnpm audit:magic`).
export const STUDIO_SIZE = { FEWER: 'FEWER', DEFAULT: 'USUAL', MORE: 'MORE' } as const;

export const STUDIO_DIFFICULTY = { EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' } as const;

/** What the reader thought of an output. */
export const STUDIO_FEEDBACK = { GOOD: 'GOOD', BAD: 'BAD' } as const;

/** The longest topic or instruction a reader can give the Studio. */
export const MAX_STUDIO_FOCUS_CHARS = 2000;
const MAX_STUDIO_SOURCES = 100;
/** How many columns a data table has: a table with one column is a list, one with many does not fit. */
export const MIN_DATA_TABLE_COLUMNS = 2;
export const MAX_DATA_TABLE_COLUMNS = 8;

export const StudioKindSchema = z.enum(STUDIO_KIND);
export const ReportFormatSchema = z.enum(REPORT_FORMAT);
export const StudioSizeSchema = z.enum(STUDIO_SIZE);
export const StudioDifficultySchema = z.enum(STUDIO_DIFFICULTY);
export const StudioFeedbackSchema = z.enum(STUDIO_FEEDBACK);

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

const quizQuestion = z.object({
  question: text,
  options: z.array(text).length(QUIZ_OPTIONS),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .max(QUIZ_OPTIONS - 1),
  explanation: text,
  chunkIds,
});
const quizExtras = { hint: text, rationales: z.array(text).length(QUIZ_OPTIONS) };

/**
 * A quiz as it is stored. The hint and the reason for each option came later, so a quiz made before
 * has neither; the view then falls back to the one explanation.
 */
export const QuizSchema = z.object({
  questions: z.array(
    quizQuestion.extend({
      hint: quizExtras.hint.optional(),
      rationales: quizExtras.rationales.optional(),
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

/**
 * A table of the facts in the sources. A cell whose citation did not hold up is kept empty, so
 * every row keeps one value per column; a cell with text always has its checked IDs.
 */
export const DataTableSchema = z.object({
  title: text,
  columns: z.array(text).min(MIN_DATA_TABLE_COLUMNS).max(MAX_DATA_TABLE_COLUMNS),
  rows: z.array(z.object({ cells: z.array(z.object({ text: z.string().trim(), chunkIds })) })),
});

/**
 * What the model returns for each kind. Flashcards and quizzes carry the title of the output, and a
 * quiz a hint and a reason for every option, which the stored form may lack (see QuizSchema).
 */
// The title comes first, so the model names the set before it fills it.
export const FlashcardsReplySchema = z.object({ title: text, ...FlashcardsSchema.shape });
export const QuizReplySchema = z.object({
  title: text,
  questions: z.array(quizQuestion.extend(quizExtras)),
});

/**
 * How an output was asked for: the instruction as the reader could have written it, and the
 * sources it was made from (their titles are kept, the sources may be gone later).
 */
export const StudioRequestSchema = z.object({
  prompt: text,
  sources: z.array(z.object({ id: z.uuid(), title: z.string() })),
});

const outputBase = {
  id: z.uuid(),
  title: text,
  createdAt: z.iso.datetime(),
  /** Null for an output from before this was kept. */
  request: StudioRequestSchema.nullable().default(null),
  /** True from the moment it is made until it is opened for the first time (the blue dot). */
  unread: z.boolean().default(false),
  feedback: StudioFeedbackSchema.nullable().default(null),
};

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
  z.object({ ...outputBase, kind: z.literal(STUDIO_KIND.DATA_TABLE), content: DataTableSchema }),
]);

export const StudioOutputListSchema = z.array(StudioOutputSchema);

const requestOptions = {
  /** Which of the selected sources to use. Absent: all of them. */
  sourceIds: z.array(z.uuid()).min(1).max(MAX_STUDIO_SOURCES).optional(),
  /** A topic to focus on; for a custom report the instruction itself. */
  focus: z.string().trim().max(MAX_STUDIO_FOCUS_CHARS).optional(),
};

const sizeOptions = {
  size: StudioSizeSchema.default(STUDIO_SIZE.DEFAULT),
  difficulty: StudioDifficultySchema.default(STUDIO_DIFFICULTY.MEDIUM),
};

/** The request to make an output. Only a report has a format; cards and questions have a size. */
export const CreateStudioBodySchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal(STUDIO_KIND.REPORT), format: ReportFormatSchema, ...requestOptions })
    .refine((body) => body.format !== REPORT_FORMAT.CUSTOM || (body.focus ?? '') !== '', {
      message: 'A report the reader writes needs the instruction.',
      path: ['focus'],
    }),
  z.object({ kind: z.literal(STUDIO_KIND.FLASHCARDS), ...sizeOptions, ...requestOptions }),
  z.object({ kind: z.literal(STUDIO_KIND.QUIZ), ...sizeOptions, ...requestOptions }),
  z.object({ kind: z.literal(STUDIO_KIND.MINDMAP), ...requestOptions }),
  z.object({ kind: z.literal(STUDIO_KIND.DATA_TABLE), ...requestOptions }),
]);

/** What can change on an output afterwards: its name, what the reader thought, that it was read. */
export const StudioUpdateBodySchema = z
  .object({
    title: text,
    feedback: StudioFeedbackSchema.nullable(),
    read: z.literal(true),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to change.' });

export type StudioKind = z.infer<typeof StudioKindSchema>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
export type StudioSize = z.infer<typeof StudioSizeSchema>;
export type StudioDifficulty = z.infer<typeof StudioDifficultySchema>;
export type StudioFeedback = z.infer<typeof StudioFeedbackSchema>;
export type StudioRequest = z.infer<typeof StudioRequestSchema>;
export type FlashcardsReply = z.infer<typeof FlashcardsReplySchema>;
export type QuizReply = z.infer<typeof QuizReplySchema>;
export type Report = z.infer<typeof ReportSchema>;
export type Flashcards = z.infer<typeof FlashcardsSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Mindmap = z.infer<typeof MindmapSchema>;
export type DataTable = z.infer<typeof DataTableSchema>;
export type StudioOutput = z.infer<typeof StudioOutputSchema>;
/** An output before it has an ID and a date, and before anyone read or rated it. */
export type NewStudioOutput = StudioOutput extends infer Output
  ? Output extends StudioOutput
    ? Omit<Output, 'id' | 'createdAt' | 'unread' | 'feedback'>
    : never
  : never;
export type CreateStudioBody = z.infer<typeof CreateStudioBodySchema>;
export type StudioUpdateBody = z.infer<typeof StudioUpdateBodySchema>;
