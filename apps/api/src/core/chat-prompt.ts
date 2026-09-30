import { AnswerSchema } from '@nlm/shared';
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
