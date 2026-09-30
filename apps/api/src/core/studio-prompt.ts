import {
  CHAT_LANGUAGE,
  type ChatLanguage,
  type CreateStudioBody,
  type Flashcards,
  FlashcardsSchema,
  type Mindmap,
  MindmapSchema,
  type NewStudioOutput,
  type Quiz,
  QuizSchema,
  type Report,
  REPORT_FORMAT,
  type ReportFormat,
  ReportSchema,
  STUDIO_KIND,
} from '@nlm/shared';
import { z } from 'zod';

import { buildChatContext, type ChatContext, type ContextChunk } from './chat-context';

/** Titles of outputs the model does not name itself. */
export const STUDIO_DEFAULT_TITLE = { FLASHCARDS: 'Karteikarten', QUIZ: 'Quiz' } as const;

/** The reply had content, but none of it was supported by a passage the model was shown. */
export class EmptyStudioOutputError extends Error {
  constructor() {
    super('No part of the generated output is supported by the sources.');
    this.name = 'EmptyStudioOutputError';
  }
}

const REPORT_INSTRUCTION: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]:
    'Write a briefing document: a short title and three to six sections (for example context, ' +
    'key findings, open questions, conclusion), each with a few statements.',
  [REPORT_FORMAT.FAQ]:
    'Write an FAQ: a short title and five to eight sections. Each section heading is a question ' +
    'a reader would ask, and its statements are the answer.',
  [REPORT_FORMAT.STUDY_GUIDE]:
    'Write a study guide: a short title and sections for key terms, main ideas and points to ' +
    'remember. Explain each term in one or two statements.',
};

const KIND_INSTRUCTION = {
  [STUDIO_KIND.FLASHCARDS]:
    'Make ten to fifteen flashcards. "front" is a question or a term, "back" the short answer.',
  [STUDIO_KIND.QUIZ]:
    'Make eight to ten multiple-choice questions. Each has exactly four options, one of them ' +
    'correct (correctIndex counts from 0), plausible wrong options and a one-sentence explanation.',
  [STUDIO_KIND.MINDMAP]:
    'Make a mind map: a title (the central topic), three to six branches, each with two to four ' +
    'children, and children may have up to three children. Labels are short noun phrases of at ' +
    'most six words.',
} as const;

const toJsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema);
  return rest;
};

const SCHEMA = {
  [STUDIO_KIND.REPORT]: toJsonSchema(ReportSchema),
  [STUDIO_KIND.FLASHCARDS]: toJsonSchema(FlashcardsSchema),
  [STUDIO_KIND.QUIZ]: toJsonSchema(QuizSchema),
  [STUDIO_KIND.MINDMAP]: toJsonSchema(MindmapSchema),
} as const;

function systemPrompt(body: CreateStudioBody, language: ChatLanguage): string {
  const task =
    body.kind === STUDIO_KIND.REPORT
      ? REPORT_INSTRUCTION[body.format]
      : KIND_INSTRUCTION[body.kind];
  return (
    'You make study material from the numbered passages of the user documents. Use only those ' +
    `passages. Always write in ${language === CHAT_LANGUAGE.EN ? 'English' : 'German'}, whatever ` +
    'language the passages have. Every statement, card, question and mind map label must cite one ' +
    'or more passage IDs (for example "c2") in chunkIds and must be supported by the cited ' +
    'passages. Never cite an ID that is not in the context. State a number, date or name only if ' +
    'a cited passage says it literally. Do not add facts from elsewhere. ' +
    task
  );
}

/** What goes to the model: the instruction for the kind, the numbered passages and the schema. */
export function studioRequest(
  body: CreateStudioBody,
  chunks: readonly ContextChunk[],
  language: ChatLanguage
) {
  const context = buildChatContext(chunks);
  return {
    system: systemPrompt(body, language),
    user: `${context.promptText}\n\nMake the requested output now.`,
    schema: SCHEMA[body.kind],
    context,
  };
}

/** Labels the model cited, as real chunk IDs. Labels that were never shown are left out. */
const resolve = (labels: readonly string[], context: ChatContext): string[] => [
  ...new Set(labels.flatMap((label) => context.idByLabel.get(label) ?? [])),
];

/**
 * Keeps what has a valid citation and counts the rest. This is the citation contract of the chat,
 * applied to every part of a generated output.
 */
function checked<T extends { chunkIds: string[] }>(
  items: readonly T[],
  context: ChatContext
): { kept: T[]; dropped: number } {
  const kept = items.flatMap((item) => {
    const chunkIds = resolve(item.chunkIds, context);
    return chunkIds.length > 0 ? [{ ...item, chunkIds }] : [];
  });
  return { kept, dropped: items.length - kept.length };
}

function checkReport(report: Report, context: ChatContext) {
  let dropped = 0;
  const sections = report.sections.flatMap((section) => {
    const result = checked(section.statements, context);
    dropped += result.dropped;
    return result.kept.length > 0 ? [{ heading: section.heading, statements: result.kept }] : [];
  });
  return { content: { title: report.title, sections }, dropped, size: sections.length };
}

function checkFlashcards(flashcards: Flashcards, context: ChatContext) {
  const { kept, dropped } = checked(flashcards.cards, context);
  return { content: { cards: kept }, dropped, size: kept.length };
}

function checkQuiz(quiz: Quiz, context: ChatContext) {
  const { kept, dropped } = checked(quiz.questions, context);
  return { content: { questions: kept }, dropped, size: kept.length };
}

function checkMindmap(mindmap: Mindmap, context: ChatContext) {
  let dropped = 0;
  const branches = checked(mindmap.branches, context);
  dropped += branches.dropped;
  const kept = branches.kept.map((branch) => {
    const twigs = checked(branch.children, context);
    dropped += twigs.dropped;
    return {
      ...branch,
      children: twigs.kept.map((twig) => {
        const leaves = checked(twig.children, context);
        dropped += leaves.dropped;
        return { ...twig, children: leaves.kept };
      }),
    };
  });
  return { content: { title: mindmap.title, branches: kept }, dropped, size: kept.length };
}

/**
 * Reads the model's reply for the requested kind. A reply that does not fit the contract throws;
 * so does one of which no part is supported by the passages.
 */
export function readStudioReply(
  body: CreateStudioBody,
  reply: string,
  context: ChatContext
): { output: NewStudioOutput; dropped: number } {
  const raw: unknown = JSON.parse(reply);
  let result: { output: NewStudioOutput; dropped: number; size: number };

  switch (body.kind) {
    case STUDIO_KIND.REPORT: {
      const { content, dropped, size } = checkReport(ReportSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, format: body.format, title: content.title, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.FLASHCARDS: {
      const { content, dropped, size } = checkFlashcards(FlashcardsSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, title: STUDIO_DEFAULT_TITLE.FLASHCARDS, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.QUIZ: {
      const { content, dropped, size } = checkQuiz(QuizSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, title: STUDIO_DEFAULT_TITLE.QUIZ, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.MINDMAP: {
      const { content, dropped, size } = checkMindmap(MindmapSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, title: content.title, content },
        dropped,
        size,
      };
      break;
    }
  }

  if (result.size === 0) throw new EmptyStudioOutputError();
  return { output: result.output, dropped: result.dropped };
}
