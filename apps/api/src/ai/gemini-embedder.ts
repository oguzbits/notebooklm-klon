import {
  EMBEDDING_DIMENSIONS,
  USAGE_PURPOSE,
  USAGE_ROLE,
  type UsageEvent,
  type UsagePurpose,
} from '@nlm/shared';
import { z } from 'zod';

import { postGemini } from './gemini-http';
import type { RateLimiter } from './rate-limiter';

const CHARS_PER_TOKEN = 3;

// gemini-embedding-2 takes the task as an instruction inside the text, there is no taskType field.
// Another embedding model needs another format here, and all stored vectors would need a re-embed.
const documentText = (text: string) => `title: none | text: ${text}`;
const queryText = (text: string) => `task: search result | query: ${text}`;

const ResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()) })),
  usageMetadata: z.object({ promptTokenCount: z.number().optional() }).optional(),
});

export interface GeminiEmbedderConfig {
  apiKey: string;
  /** From the environment, never written in code. */
  model: string;
  limiter: RateLimiter;
  sleep: (ms: number) => Promise<void>;
  /** Stores what a call cost. Awaited, so a failure to count is a failure of the call. */
  record: (event: UsageEvent) => Promise<void>;
  /** Longest wait for one attempt, answer body included. */
  timeoutMs?: number | undefined;
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

/** Embeddings through the Gemini API: one request per call, all texts in one batch. */
export function createGeminiEmbedder(config: GeminiEmbedderConfig) {
  async function embed(
    texts: string[],
    userId: string,
    purpose: UsagePurpose
  ): Promise<number[][]> {
    const estimatedTokens = texts.reduce(
      (sum, text) => sum + Math.ceil(text.length / CHARS_PER_TOKEN),
      0
    );
    const json = await config.limiter.schedule(estimatedTokens, () =>
      postGemini(config, `models/${config.model}:batchEmbedContents`, {
        requests: texts.map((text) => ({
          model: `models/${config.model}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      })
    );
    const { embeddings, usageMetadata } = ResponseSchema.parse(json);
    const reported = usageMetadata?.promptTokenCount;
    await config.record({
      userId,
      purpose,
      role: USAGE_ROLE.EMBED,
      inputTokens: reported ?? estimatedTokens,
      outputTokens: 0,
      estimated: reported === undefined,
    });
    if (embeddings.length !== texts.length) {
      throw new Error(`expected ${texts.length} embeddings, got ${embeddings.length}`);
    }
    return embeddings.map(({ values }) => {
      if (values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`expected ${EMBEDDING_DIMENSIONS} dimensions, got ${values.length}`);
      }
      return normalize(values);
    });
  }

  return {
    embedDocuments: (texts: string[], userId: string) =>
      embed(texts.map(documentText), userId, USAGE_PURPOSE.EMBED),
    /** A question is counted as part of the chat, the passages of a new source as embedding. */
    async embedQuery(text: string, userId: string): Promise<number[]> {
      const [vector] = await embed([queryText(text)], userId, USAGE_PURPOSE.CHAT);
      if (!vector) throw new Error('no embedding returned');
      return vector;
    },
  };
}
