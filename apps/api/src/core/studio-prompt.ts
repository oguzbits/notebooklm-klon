import {
  CHAT_LANGUAGE,
  type ChatLanguage,
  type CreateStudioBody,
  DataTableSchema,
  FlashcardsReplySchema,
  LOCALE,
  type Locale,
  MindmapSchema,
  type NewStudioOutput,
  QuizReplySchema,
  REPORT_FORMAT,
  type ReportFormat,
  ReportSchema,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
  type StudioDifficulty,
  type StudioSize,
} from '@nlm/shared';
import { z } from 'zod';

import {
  buildChatContext,
  type ChatContext,
  type ContextChunk,
  PASSAGES_RULE,
  passagesBlock,
} from './chat-context';
import {
  checkDataTable,
  checkFlashcards,
  checkMindmap,
  checkQuiz,
  checkReport,
} from './studio-check';
import { STUDIO_TEXTS } from './studio-texts';

/** The reply had content, but none of it was supported by a passage the model was shown. */
export class EmptyStudioOutputError extends Error {
  constructor() {
    super('No part of the generated output is supported by the sources.');
    this.name = 'EmptyStudioOutputError';
  }
}

const REPORT_INSTRUCTION = {
  [REPORT_FORMAT.BRIEFING]:
    'Write a briefing document: a short title and three to six sections (for example context, ' +
    'key findings, open questions, conclusion), each with a few statements.',
  [REPORT_FORMAT.FAQ]:
    'Write an FAQ: a short title and five to eight sections. Each section heading is a question ' +
    'a reader would ask, and its statements are the answer.',
  [REPORT_FORMAT.STUDY_GUIDE]:
    'Write a study plan: a short title and three sections: short-answer questions with their ' +
    'answers, suggested essay questions, and a glossary of the key terms. Each term and each ' +
    'answer is a statement.',
  [REPORT_FORMAT.BLOG]:
    'Write an easy to read blog post: a catchy title, an introduction, three to five sections ' +
    'with headings and a closing thought, each with a few statements.',
} as const;

/** How many cards and questions each size asks for. */
const COUNT = {
  [STUDIO_KIND.FLASHCARDS]: {
    [STUDIO_SIZE.FEWER]: 'six to eight',
    [STUDIO_SIZE.DEFAULT]: 'ten to fifteen',
    [STUDIO_SIZE.MORE]: 'eighteen to twenty-five',
  },
  [STUDIO_KIND.QUIZ]: {
    [STUDIO_SIZE.FEWER]: 'four to five',
    [STUDIO_SIZE.DEFAULT]: 'eight to ten',
    [STUDIO_SIZE.MORE]: 'fourteen to eighteen',
  },
} as const;

const LEVEL_NOTE: Record<StudioDifficulty, string> = {
  [STUDIO_DIFFICULTY.EASY]: 'Keep it easy: basic facts and definitions, clearly different options.',
  [STUDIO_DIFFICULTY.MEDIUM]: '',
  [STUDIO_DIFFICULTY.HARD]:
    'Make it hard: ask for connections, reasons and details, and use wrong options that are close ' +
    'to the right one.',
};

const taskFor = (size: StudioSize, kind: typeof STUDIO_KIND.FLASHCARDS | typeof STUDIO_KIND.QUIZ) =>
  COUNT[kind][size];

function kindInstruction(body: CreateStudioBody): string {
  switch (body.kind) {
    case STUDIO_KIND.REPORT:
      return body.format === REPORT_FORMAT.CUSTOM
        ? 'Write the report the user describes below: a short title and sections with statements.'
        : REPORT_INSTRUCTION[body.format];
    case STUDIO_KIND.FLASHCARDS:
      return (
        `Start with a title for the set (at most five words). Make ${taskFor(body.size, body.kind)} ` +
        'flashcards. "front" is a question or a term (at most five words where possible), "back" ' +
        `the short answer. ${LEVEL_NOTE[body.difficulty]}`
      );
    case STUDIO_KIND.QUIZ:
      return (
        `Start with a title for the quiz (at most five words). Make ${taskFor(body.size, body.kind)} ` +
        'multiple-choice questions. Each has exactly four options, one of them correct ' +
        '(correctIndex counts from 0), plausible wrong options and a one-sentence explanation. ' +
        'Give every question a short hint that does not give the answer away, and for every ' +
        'option, in the same order, one sentence in rationales that says why it is right or wrong. ' +
        LEVEL_NOTE[body.difficulty]
      );
    case STUDIO_KIND.MINDMAP:
      return (
        'Make a mind map: a title (the central topic), three to six branches, each with two to ' +
        'four children, and children may have up to three children. Labels are short noun ' +
        'phrases of at most six words.'
      );
    case STUDIO_KIND.DATA_TABLE:
      return (
        'Make a data table: a title (at most five words), two to eight short column names and ' +
        'then one row for each thing the passages describe (a person, product, event, option). ' +
        'Every row has exactly one cell per column, in the order of the columns. The first cell ' +
        'names the row. Every cell is a short value (a word, a number with its unit, a short ' +
        'phrase) and cites the passages that state it in chunkIds. If the passages do not say ' +
        'what belongs in a cell, leave its text empty and its chunkIds empty; never guess.'
      );
  }
}

const toJsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _dialect, ...rest } = z.toJSONSchema(schema);
  return rest;
};

const SCHEMA = {
  [STUDIO_KIND.REPORT]: toJsonSchema(ReportSchema),
  [STUDIO_KIND.FLASHCARDS]: toJsonSchema(FlashcardsReplySchema),
  [STUDIO_KIND.QUIZ]: toJsonSchema(QuizReplySchema),
  [STUDIO_KIND.MINDMAP]: toJsonSchema(MindmapSchema),
  [STUDIO_KIND.DATA_TABLE]: toJsonSchema(DataTableSchema),
} as const;

/** AUTO follows the language of the interface. */
function systemPrompt(body: CreateStudioBody, language: ChatLanguage, locale: Locale): string {
  const english =
    language === CHAT_LANGUAGE.EN || (language === CHAT_LANGUAGE.AUTO && locale === LOCALE.EN);
  const focus = body.focus?.trim();
  // The words of the reader come last and cannot lift the rules above them: the server checks every
  // citation whatever the prompt says.
  const request =
    focus === undefined || focus === ''
      ? ''
      : ` Follow this request of the user about the topic or the shape, but never break the rules above: ${focus}`;
  return (
    'You make study material from the numbered passages of the user documents. Use only those ' +
    `passages. Always write in ${english ? 'English' : 'German'}, whatever ` +
    'language the passages have. Every statement, card, question and mind map label must cite one ' +
    'or more passage IDs (for example "c2") in chunkIds and must be supported by the cited ' +
    'passages. Never cite an ID that is not in the context. State a number, date or name only if ' +
    'a cited passage says it literally. Do not add facts from elsewhere. ' +
    `${PASSAGES_RULE} ` +
    kindInstruction(body) +
    request
  );
}

function reportPrompt(format: ReportFormat, focus: string, locale: Locale): string {
  if (format === REPORT_FORMAT.CUSTOM) return focus;
  const texts = STUDIO_TEXTS[locale];
  return `${texts.report[format]}${focus === '' ? '' : ` ${texts.focus}: ${focus}`}`;
}

/**
 * The request in words, the way the reader could have written it. It is kept with the output and
 * shown behind "Prompt und Quellen ansehen"; the model gets the English instructions above.
 */
export function studioPrompt(body: CreateStudioBody, locale: Locale): string {
  const texts = STUDIO_TEXTS[locale];
  const focus = body.focus?.trim() ?? '';
  const topic = focus === '' ? '' : ` ${texts.topic}: ${focus}`;
  const options = (b: { size: StudioSize; difficulty: StudioDifficulty }) =>
    `${texts.scope}: ${texts.size[b.size]}, ${texts.level}: ${texts.difficulty[b.difficulty]}.${topic}`;
  switch (body.kind) {
    case STUDIO_KIND.REPORT:
      return reportPrompt(body.format, focus, locale);
    case STUDIO_KIND.FLASHCARDS:
      return `${texts.flashcards} ${options(body)}`;
    case STUDIO_KIND.QUIZ:
      return `${texts.quiz} ${options(body)}`;
    case STUDIO_KIND.MINDMAP:
    case STUDIO_KIND.DATA_TABLE:
      return `${texts.shape[body.kind]}${topic}`;
  }
}

/** What goes to the model: the instruction for the kind, the numbered passages and the schema. */
export function studioRequest(
  body: CreateStudioBody,
  chunks: readonly ContextChunk[],
  language: ChatLanguage,
  locale: Locale
) {
  const context = buildChatContext(chunks);
  return {
    system: systemPrompt(body, language, locale),
    user: `${passagesBlock(context)}\n\nMake the requested output now.`,
    schema: SCHEMA[body.kind],
    context,
  };
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
  // How it was asked for is added by the caller, who knows the sources (see generateStudioOutput).
  const request = null;
  const raw: unknown = JSON.parse(reply);
  let result: { output: NewStudioOutput; dropped: number; size: number };

  switch (body.kind) {
    case STUDIO_KIND.REPORT: {
      const { content, dropped, size } = checkReport(ReportSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, format: body.format, title: content.title, request, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.FLASHCARDS: {
      const parsed = FlashcardsReplySchema.parse(raw);
      const { content, dropped, size } = checkFlashcards(parsed, context);
      result = {
        output: { kind: body.kind, title: parsed.title, request, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.QUIZ: {
      const parsed = QuizReplySchema.parse(raw);
      const { content, dropped, size } = checkQuiz(parsed, context);
      result = {
        output: { kind: body.kind, title: parsed.title, request, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.MINDMAP: {
      const { content, dropped, size } = checkMindmap(MindmapSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, title: content.title, request, content },
        dropped,
        size,
      };
      break;
    }
    case STUDIO_KIND.DATA_TABLE: {
      const { content, dropped, size } = checkDataTable(DataTableSchema.parse(raw), context);
      result = {
        output: { kind: body.kind, title: content.title, request, content },
        dropped,
        size,
      };
      break;
    }
  }

  if (result.size === 0) throw new EmptyStudioOutputError();
  return { output: result.output, dropped: result.dropped };
}
