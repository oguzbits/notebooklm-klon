import {
  CHAT_LANGUAGE,
  type ChatLanguage,
  type CreateStudioBody,
  type Flashcards,
  FlashcardsReplySchema,
  type Mindmap,
  MindmapSchema,
  type NewStudioOutput,
  type Quiz,
  QuizReplySchema,
  type Report,
  REPORT_FORMAT,
  ReportSchema,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
  type StudioDifficulty,
  type StudioSize,
} from '@nlm/shared';
import { z } from 'zod';

import { buildChatContext, type ChatContext, type ContextChunk } from './chat-context';

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
} as const;

function systemPrompt(body: CreateStudioBody, language: ChatLanguage): string {
  const focus = body.focus?.trim();
  // The words of the reader come last and cannot lift the rules above them: the server checks every
  // citation whatever the prompt says.
  const request =
    focus === undefined || focus === ''
      ? ''
      : ` Follow this request of the user about the topic or the shape, but never break the rules above: ${focus}`;
  return (
    'You make study material from the numbered passages of the user documents. Use only those ' +
    `passages. Always write in ${language === CHAT_LANGUAGE.EN ? 'English' : 'German'}, whatever ` +
    'language the passages have. Every statement, card, question and mind map label must cite one ' +
    'or more passage IDs (for example "c2") in chunkIds and must be supported by the cited ' +
    'passages. Never cite an ID that is not in the context. State a number, date or name only if ' +
    'a cited passage says it literally. Do not add facts from elsewhere. ' +
    kindInstruction(body) +
    request
  );
}

const SIZE_LABEL: Record<StudioSize, string> = {
  [STUDIO_SIZE.FEWER]: 'Weniger',
  [STUDIO_SIZE.DEFAULT]: 'Standard',
  [STUDIO_SIZE.MORE]: 'Mehr',
};

const DIFFICULTY_LABEL: Record<StudioDifficulty, string> = {
  [STUDIO_DIFFICULTY.EASY]: 'Einfach',
  [STUDIO_DIFFICULTY.MEDIUM]: 'Mittel',
  [STUDIO_DIFFICULTY.HARD]: 'Schwer',
};

const REPORT_PROMPT = {
  [REPORT_FORMAT.BRIEFING]:
    'Erstelle ein ausführliches Briefing-Dokument, das die wichtigsten Themen, Belege und ' +
    'Schlussfolgerungen der Quellen zusammenfasst. Beginne mit einer kurzen Zusammenfassung, ' +
    'gliedere den Text logisch mit Überschriften und halte den Ton sachlich und prägnant.',
  [REPORT_FORMAT.FAQ]:
    'Erstelle einen Katalog häufiger Fragen zu den Quellen. Jede Überschrift ist eine Frage, die ' +
    'ein Leser stellen würde, und der Text darunter beantwortet sie aus den Quellen.',
  [REPORT_FORMAT.STUDY_GUIDE]:
    'Erstelle einen Lernplan mit Fragen und kurzen Antworten, vorgeschlagenen Essay-Fragestellungen ' +
    'und einem Glossar der wichtigsten Begriffe.',
  [REPORT_FORMAT.BLOG]:
    'Schreibe einen leicht verständlichen Blogpost, der die Kernpunkte der Quellen zusammenfasst.',
} as const;

/**
 * The request in words, the way the reader could have written it. It is kept with the output and
 * shown behind "Prompt und Quellen ansehen"; the model gets the English instructions above.
 */
export function studioPrompt(body: CreateStudioBody): string {
  const focus = body.focus?.trim() ?? '';
  const topic = focus === '' ? '' : ` Thema: ${focus}`;
  switch (body.kind) {
    case STUDIO_KIND.REPORT:
      return body.format === REPORT_FORMAT.CUSTOM
        ? focus
        : `${REPORT_PROMPT[body.format]}${focus === '' ? '' : ` Schwerpunkt: ${focus}`}`;
    case STUDIO_KIND.FLASHCARDS:
      return (
        'Erstelle Karteikarten zu den Quellen. ' +
        `Umfang: ${SIZE_LABEL[body.size]}, Schwierigkeit: ${DIFFICULTY_LABEL[body.difficulty]}.${topic}`
      );
    case STUDIO_KIND.QUIZ:
      return (
        'Erstelle ein Quiz mit Multiple-Choice-Fragen zu den Quellen. ' +
        `Umfang: ${SIZE_LABEL[body.size]}, Schwierigkeit: ${DIFFICULTY_LABEL[body.difficulty]}.${topic}`
      );
    case STUDIO_KIND.MINDMAP:
      return `Erstelle eine Mindmap, die die Quellen übersichtlich gliedert.${topic}`;
  }
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
  }

  if (result.size === 0) throw new EmptyStudioOutputError();
  return { output: result.output, dropped: result.dropped };
}
