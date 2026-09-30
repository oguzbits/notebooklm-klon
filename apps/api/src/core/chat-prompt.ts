import { AnswerSchema, CHAT_LANGUAGE, CHAT_LENGTH, CHAT_STYLE, type ChatConfig } from '@nlm/shared';
import { z } from 'zod';

import type { ChatContext } from './chat-context';

export const CHAT_SYSTEM_PROMPT =
  'You answer questions about the user documents. Use only the numbered context passages. ' +
  'Answer in the language of the question. Split the answer into short statements. Every ' +
  'statement must cite one or more passage IDs (for example "c2") from the context and must be ' +
  'supported by the cited passages. Never cite an ID that is not in the context. State a number, ' +
  'date or name only if a cited passage says it literally; do not derive it from a related ' +
  'figure. If the context does not contain the answer, return one statement saying so with an ' +
  'empty citation list.';

/** The answer contract as JSON Schema for the provider, derived from the shared schema. */
export const ANSWER_JSON_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(AnswerSchema);
  return schema;
})();

/** The user turn: numbered passages, then the question. */
export function buildUserMessage(context: ChatContext, question: string): string {
  const passages = context.promptText === '' ? '' : `${context.promptText}\n\n`;
  return `${passages}Question: ${question}`;
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
export function chatSystemPrompt(config: ChatConfig): string {
  const notes: string[] = [];
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
