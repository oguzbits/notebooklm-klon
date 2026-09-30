import { EMBEDDING_DIMENSIONS } from '@nlm/shared';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { createGeminiEmbedder } from './gemini-embedder';
import { GeminiError } from './gemini-error';
import { RateLimiter } from './rate-limiter';

const MODEL = 'test-embedding-model';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;
const KEY = 'test-key-not-real';

const values = (first: number) => [
  first,
  ...Array.from({ length: EMBEDDING_DIMENSIONS - 1 }, () => 0),
];

function makeEmbedder(overrides: { sleeps?: number[]; limiter?: RateLimiter } = {}) {
  const sleeps = overrides.sleeps ?? [];
  return createGeminiEmbedder({
    apiKey: KEY,
    model: MODEL,
    limiter:
      overrides.limiter ?? new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1_000_000 }),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

describe('createGeminiEmbedder', () => {
  it('sends all documents in one request with the document format and returns normalized vectors in order', async () => {
    let seen: { headers: Headers; body: { requests: Record<string, unknown>[] } } | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = { headers: request.headers, body: (await request.json()) as never };
        return HttpResponse.json({ embeddings: [{ values: values(3) }, { values: values(4) }] });
      })
    );

    const vectors = await makeEmbedder().embedDocuments(['Erster Text', 'Zweiter Text']);

    expect(seen?.headers.get('x-goog-api-key')).toBe(KEY);
    expect(seen?.body.requests).toEqual([
      {
        model: `models/${MODEL}`,
        content: { parts: [{ text: 'title: none | text: Erster Text' }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
      {
        model: `models/${MODEL}`,
        content: { parts: [{ text: 'title: none | text: Zweiter Text' }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    ]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]?.[0]).toBeCloseTo(1);
    expect(vectors[1]?.[0]).toBeCloseTo(1);
  });

  it('embeds a question with the query format', async () => {
    let sentText: string | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        const body = (await request.json()) as {
          requests: { content: { parts: { text: string }[] } }[];
        };
        sentText = body.requests[0]?.content.parts[0]?.text;
        return HttpResponse.json({ embeddings: [{ values: values(2) }] });
      })
    );

    const vector = await makeEmbedder().embedQuery('Wer leitet das Projekt?');

    expect(sentText).toBe('task: search result | query: Wer leitet das Projekt?');
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('fails when the provider returns a different number of vectors', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ embeddings: [{ values: values(1) }] }))
    );

    await expect(makeEmbedder().embedDocuments(['a', 'b'])).rejects.toThrow(
      /expected 2 embeddings/
    );
  });

  it('fails when a vector has the wrong size', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ embeddings: [{ values: [1, 2, 3] }] }))
    );

    await expect(makeEmbedder().embedDocuments(['a'])).rejects.toThrow(/dimensions/);
  });

  it('waits and tries again after a 429, then succeeds', async () => {
    let calls = 0;
    server.use(
      http.post(ENDPOINT, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { message: 'quota' } },
              { status: 429, headers: { 'retry-after': '7' } }
            )
          : HttpResponse.json({ embeddings: [{ values: values(1) }] });
      })
    );
    const sleeps: number[] = [];

    await makeEmbedder({ sleeps }).embedDocuments(['a']);

    expect(calls).toBe(2);
    expect(sleeps).toEqual([7000]);
  });

  it('gives up after repeated 429 answers and reports the status', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ error: { message: 'quota' } }, { status: 429 }))
    );

    const error = await makeEmbedder()
      .embedDocuments(['a'])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GeminiError);
    expect((error as GeminiError).status).toBe(429);
  });

  it('does not retry a client error', async () => {
    let calls = 0;
    server.use(
      http.post(ENDPOINT, () => {
        calls += 1;
        return HttpResponse.json({ error: { message: 'bad request' } }, { status: 400 });
      })
    );

    await expect(makeEmbedder().embedDocuments(['a'])).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  it('goes through the rate limiter with an estimate of the tokens', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ embeddings: [{ values: values(1) }] }))
    );
    const scheduled: number[] = [];
    const limiter = new RateLimiter({ requestsPerMinute: 10, tokensPerMinute: 30_000 });
    const original = limiter.schedule.bind(limiter);
    limiter.schedule = (tokens, task) => {
      scheduled.push(tokens);
      return original(tokens, task);
    };

    await makeEmbedder({ limiter }).embedDocuments(['x'.repeat(300)]);

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toBeGreaterThanOrEqual(100);
  });

  it('never puts the API key or the text into an error message', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({ error: { message: 'kaputt' } }, { status: 500 })
      )
    );

    const error = await makeEmbedder()
      .embedDocuments(['geheimer Dokumenttext'])
      .catch((caught: unknown) => caught);

    expect((error as Error).message).not.toContain(KEY);
    expect((error as Error).message).not.toContain('geheimer Dokumenttext');
  });
});
