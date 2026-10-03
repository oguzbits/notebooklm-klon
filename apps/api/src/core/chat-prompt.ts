import {
  CHAT_LANGUAGE,
  CHAT_LENGTH,
  CHAT_STYLE,
  type ChatConfig,
  ChatReplySchema,
} from '@nlm/shared';
import { z } from 'zod';

import { type ChatContext, PASSAGES_RULE, passagesBlock } from './chat-context';
import { HISTORY_RULE, historyBlock, type HistoryTurn } from './chat-history';

export const CHAT_SYSTEM_PROMPT =
  'You answer questions about the user documents. Use only the numbered context passages. ' +
  `${PASSAGES_RULE} ` +
  'Answer in the language of the question, also when the passages are in another language: ' +
  'translate their content instead of quoting it, and keep names, terms and figures. Write a ' +
  'figure the way the passage writes it: digits stay digits, a number the passage spells out in ' +
  'words stays in words. Split the answer into short statements. Every ' +
  'statement must cite one or more passage IDs (for example "c2") from the context and must be ' +
  'supported by the cited passages. Never cite an ID that is not in the context. State a number, ' +
  'date or name only if a cited passage says it literally; do not derive it from a related ' +
  'figure. Name the unit of a figure from the table header or the text around it. When one ' +
  'passage gives a figure rounded or in other units and another passage gives it exactly, give ' +
  'both forms in one statement and cite both passages; never round a figure yourself. Say each ' +
  'fact once: if several passages or phrasings state the same fact, give it in one statement and ' +
  'cite all of them instead of restating it. After the direct answer add what the passages say ' +
  'that belongs to it (components, period, scope). Answer every part of the question that the ' +
  'passages cover: when it asks for several items or compares two things, give each item and both ' +
  'sides of the comparison. When the passages cover only some parts, answer those and leave out ' +
  'the others. Include any exception, condition or limit that the passages attach to the ' +
  'answer. If a passage gives a different value for the ' +
  'same quantity because it covers another group, period or method, say so in its own statement ' +
  'and name the difference. ' +
  'If the context contains no part of the answer, return an empty statements list: ' +
  'the reader is told so, and a statement without a citation is removed anyway. A passage that ' +
  'only fits the topic of the question but does not say what was asked is no answer; do not ' +
  'build one from it. You may mark the most important terms of a statement with **bold**; ' +
  'use no other Markdown. After the statements, put at most three short follow-up questions the ' +
  'reader could ask next into followUps, written in the language of the answer and answerable ' +
  'from the context passages. A follow-up question is no statement and has no citation; leave ' +
  'followUps empty when the context does not contain the answer.';

/** The reply contract as JSON Schema for the provider, derived from the shared schema. */
export const ANSWER_JSON_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(ChatReplySchema);
  return schema;
})();

/** The user turn: the earlier turns if there are any, the numbered passages, then the question. */
export function buildUserMessage(
  context: ChatContext,
  question: string,
  history: readonly HistoryTurn[] = []
): string {
  const blocks = [historyBlock(history), passagesBlock(context)].filter((block) => block !== '');
  return `${blocks.map((block) => `${block}\n\n`).join('')}Question: ${question}`;
}

const LENGTH_NOTE = {
  [CHAT_LENGTH.SHORTER]: 'Keep the answer short: at most three statements.',
  [CHAT_LENGTH.LONGER]: 'Give a thorough answer with up to ten statements.',
} as const;

const LANGUAGE_NOTE = {
  [CHAT_LANGUAGE.DE]: 'Always answer in German, whatever language the question has.',
  [CHAT_LANGUAGE.EN]: 'Always answer in English, whatever language the question has.',
} as const;

/**
 * The system prompt of a notebook: the rules that keep answers cited, then what the user chose.
 * The user's own words come last and cannot lift the rules above them: the server checks every
 * citation whatever the prompt says.
 */
export function chatSystemPrompt(config: ChatConfig, hasHistory = false): string {
  const notes: string[] = [];
  if (hasHistory) notes.push(HISTORY_RULE);
  if (config.style === CHAT_STYLE.LEARNING_GUIDE) {
    notes.push(
      'Act as a patient learning guide: explain step by step, define terms and point out what to remember.'
    );
  }
  if (config.style === CHAT_STYLE.CUSTOM) {
    notes.push(
      `Follow this instruction of the user about tone and format, but never break the rules above: ${config.customInstruction}`
    );
  }
  if (config.length !== CHAT_LENGTH.DEFAULT) notes.push(LENGTH_NOTE[config.length]);
  if (config.language !== CHAT_LANGUAGE.AUTO) notes.push(LANGUAGE_NOTE[config.language]);
  return [CHAT_SYSTEM_PROMPT, ...notes].join(' ');
}
