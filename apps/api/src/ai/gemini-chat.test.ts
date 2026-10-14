import { USAGE_PURPOSE, USAGE_ROLE, type UsageEvent } from '@nlm/shared';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { createGeminiChat } from './gemini-chat';
import { GeminiError } from './gemini-error';
import { RateLimiter } from './rate-limiter';

const MODEL = 'test-chat-model';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent`;
const KEY = 'test-key-not-real';

const SCOPE = { userId: 'reader', purpose: USAGE_PURPOSE.CHAT };
const MAX_OUTPUT_TOKENS = {
  [USAGE_PURPOSE.CHAT]: 111,
  [USAGE_PURPOSE.STUDIO]: 222,
  [USAGE_PURPOSE.OVERVIEW]: 333,
};

const chat = (
  recorded: UsageEvent[] = [],
  overrides: { sleep?: (ms: number) => Promise<void>; timeoutMs?: number } = {}
) =>
  createGeminiChat({
    apiKey: KEY,
    model: MODEL,
    limiter: new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1_000_000 }),
    sleep: overrides.sleep ?? (async () => undefined),
    timeoutMs: overrides.timeoutMs,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    record: async (event) => {
      recorded.push(event);
    },
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
      chat().stream({ system: 'SYSTEM', user: 'FRAGE', schema: { type: 'object' }, usage: SCOPE })
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

    expect(
      (await collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))).join('')
    ).toBe('Hallo Welt');
  });

  it('records the counts of the provider for the user and purpose, thinking counted as output', async () => {
    const recorded: UsageEvent[] = [];
    server.use(
      http.post(ENDPOINT, () =>
        sse(
          part('x') +
            event({
              candidates: [{ content: { parts: [{ text: 'y' }] }, finishReason: 'STOP' }],
              usageMetadata: {
                promptTokenCount: 120,
                candidatesTokenCount: 15,
                thoughtsTokenCount: 40,
              },
            })
        )
      )
    );

    await collect(chat(recorded).stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }));

    expect(recorded).toEqual([
      { ...SCOPE, role: USAGE_ROLE.CHAT, inputTokens: 120, outputTokens: 55, estimated: false },
    ]);
  });

  it('records an estimate, marked as such, when the provider reports no counts', async () => {
    const recorded: UsageEvent[] = [];
    server.use(http.post(ENDPOINT, () => sse(part('x'.repeat(30), 'STOP'))));

    await collect(
      chat(recorded).stream({
        system: 'a'.repeat(30),
        user: 'b'.repeat(30),
        schema: {},
        usage: SCOPE,
      })
    );

    expect(recorded).toEqual([
      { ...SCOPE, role: USAGE_ROLE.CHAT, inputTokens: 20, outputTokens: 10, estimated: true },
    ]);
  });

  it('still records a call whose answer was cut off, because the tokens were spent', async () => {
    const recorded: UsageEvent[] = [];
    server.use(http.post(ENDPOINT, () => sse(part('halb', 'MAX_TOKENS'))));

    await expect(
      collect(chat(recorded).stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow();

    expect(recorded).toHaveLength(1);
  });

  it('caps the length of the answer with the limit of the purpose', async () => {
    let seen: { generationConfig?: { maxOutputTokens?: number } } | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as typeof seen;
        return sse(part('x', 'STOP'));
      })
    );

    await collect(
      chat().stream({
        system: 's',
        user: 'u',
        schema: {},
        usage: { userId: 'reader', purpose: USAGE_PURPOSE.STUDIO },
      })
    );

    expect(seen?.generationConfig?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS[USAGE_PURPOSE.STUDIO]);
  });

  it('fails instead of ending quietly when the model stops with anything but STOP', async () => {
    server.use(http.post(ENDPOINT, () => sse(part('halb', 'MAX_TOKENS'))));

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow('MAX_TOKENS');
  });

  it('fails when the stream ends without a normal finish', async () => {
    server.use(http.post(ENDPOINT, () => sse(part('abgeschnitten'))));

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow(/finish/i);
  });

  it('names the finish reason when an event has no text parts', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        sse(event({ candidates: [{ content: { role: 'model' }, finishReason: 'MAX_TOKENS' }] }))
      )
    );

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow(/MAX_TOKENS/);
  });

  it('fails when the prompt was blocked and no candidate came back', async () => {
    server.use(http.post(ENDPOINT, () => sse(event({ promptFeedback: { blockReason: 'OTHER' } }))));

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow(/OTHER/);
  });

  it('reports the status of a failed call', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({ error: { message: 'kaputt' } }, { status: 500 })
      )
    );

    await expect(
      collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
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

    expect(
      (await collect(chat().stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))).join('')
    ).toBe('ok');
    expect(calls).toBe(2);
  });

  it('gives up when the model does not answer within the timeout', async () => {
    server.use(http.post(ENDPOINT, async () => delay('infinite')));
    const stalled = chat(undefined, { timeoutMs: 50 });

    await expect(
      collect(stalled.stream({ system: 's', user: 'u', schema: {}, usage: SCOPE }))
    ).rejects.toThrow();
  });

  it('does not wait for a retry-after beyond the cap but reports the status', async () => {
    const sleeps: number[] = [];
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          { error: { message: 'quota' } },
          { status: 429, headers: { 'retry-after': '3600' } }
        )
      )
    );
    const waiting = chat(undefined, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const error = await collect(
      waiting.stream({ system: 's', user: 'u', schema: {}, usage: SCOPE })
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GeminiError);
    expect((error as GeminiError).status).toBe(429);
    expect(sleeps).toEqual([]);
  });

  it('stops waiting for a retry when the reader leaves', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ error: { message: 'quota' } }, { status: 429 }))
    );
    const reader = new AbortController();
    const waiting = chat(undefined, { sleep: () => new Promise(() => undefined) });
    const pending = collect(
      waiting.stream({ system: 's', user: 'u', schema: {}, usage: SCOPE, signal: reader.signal })
    );

    setTimeout(() => reader.abort(), 50);

    await expect(pending).rejects.toThrow();
  });
});
