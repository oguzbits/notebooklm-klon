import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { createGeminiChat } from './gemini-chat';
import { GeminiError } from './gemini-error';
import { RateLimiter } from './rate-limiter';

const MODEL = 'test-chat-model';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent`;
const KEY = 'test-key-not-real';

const chat = (onUsage?: (usage: { promptTokens: number; outputTokens: number }) => void) =>
  createGeminiChat({
    apiKey: KEY,
    model: MODEL,
    limiter: new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1_000_000 }),
    sleep: async () => undefined,
    onUsage,
  });

const event = (data: unknown) => `data: ${JSON.stringify(data)}\r\n\r\n`;
const part = (text: string, finishReason?: string) =>
  event({
    candidates: [{ content: { parts: [{ text }] }, ...(finishReason ? { finishReason } : {}) }],
  });

function sse(text: string, sliceAt: number[] = []) {
  const encoder = new TextEncoder();
  const cuts = [0, ...sliceAt, text.length];
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < cuts.length - 1; i += 1) {
          controller.enqueue(encoder.encode(text.slice(cuts[i], cuts[i + 1])));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}

async function collect(stream: AsyncIterable<string>) {
  const pieces: string[] = [];
  for await (const piece of stream) pieces.push(piece);
  return pieces;
}

describe('createGeminiChat', () => {
  it('sends the system prompt, the user message and the answer schema, and streams the text', async () => {
    let seen: Record<string, unknown> | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as Record<string, unknown>;
        expect(new URL(request.url).searchParams.get('alt')).toBe('sse');
        expect(request.headers.get('x-goog-api-key')).toBe(KEY);
        return sse(part('{"statements":') + part('[]}', 'STOP'));
      })
    );

    const pieces = await collect(
      chat().stream({ system: 'SYSTEM', user: 'FRAGE', schema: { type: 'object' } })
    );

    expect(pieces).toEqual(['{"statements":', '[]}']);
    expect(seen).toMatchObject({
      systemInstruction: { parts: [{ text: 'SYSTEM' }] },
      contents: [{ role: 'user', parts: [{ text: 'FRAGE' }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
  });

  it('handles events that are cut in the middle of a line', async () => {
    const body = part('Hallo ') + part('Welt', 'STOP');
    server.use(http.post(ENDPOINT, () => sse(body, [7, 30, 55])));

    expect((await collect(chat().stream({ system: 's', user: 'u', schema: {} }))).join('')).toBe(
      'Hallo Welt'
    );
  });

  it('reports the token counts of the answer', async () => {
    let usage: { promptTokens: number; outputTokens: number } | undefined;
    server.use(
      http.post(ENDPOINT, () =>
        sse(
          part('x') +
            event({
              candidates: [{ content: { parts: [{ text: 'y' }] }, finishReason: 'STOP' }],
              usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 15 },
            })
        )
      )
    );

    await collect(chat((u) => (usage = u)).stream({ system: 's', user: 'u', schema: {} }));

    expect(usage).toEqual({ promptTokens: 120, outputTokens: 15 });
  });

  it.each(['MAX_TOKENS', 'RECITATION', 'SAFETY'])(
    'fails instead of ending quietly when the model stops with %s',
    async (reason) => {
      server.use(http.post(ENDPOINT, () => sse(part('halb', reason))));

      await expect(collect(chat().stream({ system: 's', user: 'u', schema: {} }))).rejects.toThrow(
        reason
      );
    }
  );

  it('fails when the stream ends without a normal finish', async () => {
    server.use(http.post(ENDPOINT, () => sse(part('abgeschnitten'))));

    await expect(collect(chat().stream({ system: 's', user: 'u', schema: {} }))).rejects.toThrow(
      /finish/i
    );
  });

  it('names the finish reason when an event has no text parts', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        sse(event({ candidates: [{ content: { role: 'model' }, finishReason: 'MAX_TOKENS' }] }))
      )
    );

    await expect(collect(chat().stream({ system: 's', user: 'u', schema: {} }))).rejects.toThrow(
      /MAX_TOKENS/
    );
  });

  it('fails when the prompt was blocked and no candidate came back', async () => {
    server.use(http.post(ENDPOINT, () => sse(event({ promptFeedback: { blockReason: 'OTHER' } }))));

    await expect(collect(chat().stream({ system: 's', user: 'u', schema: {} }))).rejects.toThrow(
      /OTHER/
    );
  });

  it('reports the status of a failed call', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({ error: { message: 'kaputt' } }, { status: 500 })
      )
    );

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {} }))
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it('waits and tries again after a 429 before the stream starts', async () => {
    let calls = 0;
    server.use(
      http.post(ENDPOINT, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: { message: 'quota' } }, { status: 429 })
          : sse(part('ok', 'STOP'));
      })
    );

    expect((await collect(chat().stream({ system: 's', user: 'u', schema: {} }))).join('')).toBe(
      'ok'
    );
    expect(calls).toBe(2);
  });
});
