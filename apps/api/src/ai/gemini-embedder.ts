import { EMBEDDING_DIMENSIONS } from '@nlm/shared';
import { z } from 'zod';

import { postGemini } from './gemini-http';
import type { RateLimiter } from './rate-limiter';

const CHARS_PER_TOKEN = 3;

// gemini-embedding-2 takes the task as an instruction inside the text, there is no taskType field.
// Another embedding model needs another format here, and all stored vectors would need a re-embed.
const documentText = (text: string) => `title: none | text: ${text}`;
const queryText = (text: string) => `task: search result | query: ${text}`;

const ResponseSchema = z.object({ embeddings: z.array(z.object({ values: z.array(z.number()) })) });

export interface GeminiEmbedderConfig {
  apiKey: string;
  /** From the environment, never written in code. */
  model: string;
  limiter: RateLimiter;
  sleep: (ms: number) => Promise<void>;
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

/** Embeddings through the Gemini API: one request per call, all texts in one batch. */
export function createGeminiEmbedder(config: GeminiEmbedderConfig) {
  async function embed(texts: string[]): Promise<number[][]> {
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
    const { embeddings } = ResponseSchema.parse(json);
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
    embedDocuments: (texts: string[]) => embed(texts.map(documentText)),
    async embedQuery(text: string): Promise<number[]> {
      const [vector] = await embed([queryText(text)]);
      if (!vector) throw new Error('no embedding returned');
      return vector;
    },
  };
}
