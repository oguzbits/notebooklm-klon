import type { Answer } from '@nlm/shared';

import { sanitizeAnswer, type SanitizedAnswer } from './citations';

export interface ContextChunk {
  id: string;
  text: string;
}

export interface ChatContext {
  /** Labels shown to the model, in prompt order: c1, c2, ... */
  labels: string[];
  /** The numbered passages as they go into the prompt. */
  promptText: string;
  idByLabel: Map<string, string>;
}

/**
 * Numbers the retrieved chunks with short labels per request. The model cites labels, never real
 * IDs, so it cannot invent or mistype an ID and a real ID it was never shown cannot be cited.
 */
export function buildChatContext(chunks: readonly ContextChunk[]): ChatContext {
  const labels = chunks.map((_, index) => `c${index + 1}`);
  const idByLabel = new Map(chunks.map((chunk, index) => [`c${index + 1}`, chunk.id]));
  const promptText = chunks.map((chunk, index) => `[c${index + 1}]\n${chunk.text}`).join('\n\n');
  return { labels, promptText, idByLabel };
}

/** Validates the model's labels against the context and returns the answer with real chunk IDs. */
export function resolveCitations(answer: Answer, context: ChatContext): SanitizedAnswer {
  const sanitized = sanitizeAnswer(answer, context.labels);
  return {
    ...sanitized,
    answer: {
      statements: sanitized.answer.statements.map((statement) => ({
        text: statement.text,
        chunkIds: statement.chunkIds.flatMap((label) => {
          const id = context.idByLabel.get(label);
          return id === undefined ? [] : [id];
        }),
      })),
    },
  };
}
