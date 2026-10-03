import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../vitest.setup';
import { LIMITS } from '../config/limits';
import { GeminiError } from './gemini-error';
import { createGeminiPdfParser } from './gemini-pdf-parser';
import { RateLimiter } from './rate-limiter';

const MODEL = 'test-parse-model';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const KEY = 'test-key-not-real';
const VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const PDF = new TextEncoder().encode('%PDF-1.4 fake');

const FALLBACK_MODEL = 'test-fallback-model';
const FALLBACK_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent`;

function parser(sleeps: number[] = [], fallbackModel?: string, timeoutMs?: number) {
  return createGeminiPdfParser({
    apiKey: KEY,
    model: MODEL,
    fallbackModel,
    timeoutMs,
    limiter: new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1_000_000 }),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
}

const answer = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
});

describe('createGeminiPdfParser', () => {
  it('sends the PDF inline with a transcription prompt and returns the text', async () => {
    let seen: Record<string, unknown> | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(answer('# Titel\n\nText der Seite.'));
      })
    );

    const result = await parser().parse(PDF);

    expect(result).toEqual({ text: '# Titel\n\nText der Seite.', pageCount: null });
    const parts = (seen as { contents: { parts: Record<string, unknown>[] }[] }).contents[0]?.parts;
    expect(parts?.[0]).toEqual({
      inlineData: { mimeType: 'application/pdf', data: Buffer.from(PDF).toString('base64') },
    });
    expect(String(parts?.[1]?.text)).toMatch(/Transcribe/);
    expect(
      (seen as { generationConfig: { temperature: number } }).generationConfig.temperature
    ).toBe(0);
  });

  it('sends an image inline with its own type and a prompt that reads text and describes a picture', async () => {
    let seen: Record<string, unknown> | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(answer('Rechnung Nr. 5'));
      })
    );
    const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const result = await parser().parseImage(image, 'image/png');

    expect(result).toEqual({ text: 'Rechnung Nr. 5', pageCount: null });
    const parts = (seen as { contents: { parts: Record<string, unknown>[] }[] }).contents[0]?.parts;
    expect(parts?.[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: Buffer.from(image).toString('base64') },
    });
    expect(String(parts?.[1]?.text)).toMatch(/image/);
    expect(String(parts?.[1]?.text)).not.toMatch(/page/);
  });

  it('sends a recording inline with its own type and a prompt that transcribes the speech', async () => {
    let seen: Record<string, unknown> | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(answer('Guten Tag, willkommen.'));
      })
    );
    const recording = new Uint8Array([0x49, 0x44, 0x33, 4]);

    const result = await parser().parseAudio(recording, 'audio/mpeg');

    expect(result).toEqual({ text: 'Guten Tag, willkommen.', pageCount: null });
    const parts = (seen as { contents: { parts: Record<string, unknown>[] }[] }).contents[0]?.parts;
    expect(parts?.[0]).toEqual({
      inlineData: { mimeType: 'audio/mpeg', data: Buffer.from(recording).toString('base64') },
    });
    expect(String(parts?.[1]?.text)).toMatch(/speech/);
  });

  it('gives a recording more time than a document, and a set limit still wins', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('Text'))));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const recording = new Uint8Array([0x49, 0x44, 0x33, 4]);

    await parser().parseAudio(recording, 'audio/mpeg');
    await parser().parse(PDF);
    await parser([], undefined, 77).parseAudio(recording, 'audio/mpeg');

    // A set limit is also the time of one attempt, so it is asked for twice.
    expect([...new Set(timeout.mock.calls.map(([ms]) => ms))]).toEqual([
      LIMITS.AUDIO_PARSE_TIMEOUT_MS,
      LIMITS.PARSE_TIMEOUT_MS,
      77,
    ]);
    timeout.mockRestore();
  });

  it('counts a recording at its own cost per byte for the rate limit', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('Text'))));
    const small = createGeminiPdfParser({
      apiKey: KEY,
      model: MODEL,
      limiter: new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1000 }),
      sleep: async () => {},
    });
    // 50 kB are 400 tokens of audio, so with the prompt they fit; as a PDF they would not.
    const fits = new Uint8Array(50_000);
    const tooLong = new Uint8Array(100_000);

    await expect(small.parseAudio(fits, 'audio/mpeg')).resolves.toEqual({
      text: 'Text',
      pageCount: null,
    });
    await expect(small.parseAudio(tooLong, 'audio/mpeg')).rejects.toThrow(RangeError);
  });

  it('hands a YouTube link to the model as a file and asks for the speech', async () => {
    let seen: Record<string, unknown> | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        seen = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(answer('Das ist ein Elefant.'));
      })
    );

    const result = await parser().parseVideoUrl(VIDEO_URL);

    expect(result).toEqual({ text: 'Das ist ein Elefant.', pageCount: null });
    const parts = (seen as { contents: { parts: Record<string, unknown>[] }[] }).contents[0]?.parts;
    expect(parts?.[0]).toEqual({ fileData: { fileUri: VIDEO_URL } });
    expect(String(parts?.[1]?.text)).toMatch(/speech/);
  });

  it('waits as long for a video as for a recording', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('Text'))));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await parser().parseVideoUrl(VIDEO_URL);

    expect(timeout).toHaveBeenCalledWith(LIMITS.AUDIO_PARSE_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it('counts a video at the length the limit assumes, because its length is not known', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('Text'))));
    const limiter = new RateLimiter({ requestsPerMinute: 1000, tokensPerMinute: 1_000_000 });
    const schedule = vi.spyOn(limiter, 'schedule');
    const reader = createGeminiPdfParser({
      apiKey: KEY,
      model: MODEL,
      limiter,
      sleep: async () => {},
    });

    await reader.parseVideoUrl(VIDEO_URL);

    expect(schedule.mock.calls[0]?.[0]).toBe(LIMITS.VIDEO_ESTIMATED_TOKENS + 500);
  });

  it('refuses an image answer that did not end normally, like a PDF', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('halb', 'MAX_TOKENS'))));

    await expect(parser().parseImage(new Uint8Array([1]), 'image/png')).rejects.toThrow(
      /did not finish normally: MAX_TOKENS/
    );
  });

  it('joins the text of several parts', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          candidates: [
            {
              content: { parts: [{ text: 'Teil eins. ' }, { text: 'Teil zwei.' }] },
              finishReason: 'STOP',
            },
          ],
        })
      )
    );

    expect((await parser().parse(PDF)).text).toBe('Teil eins. Teil zwei.');
  });

  it('fails instead of returning a partial answer', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('halber Text', 'MAX_TOKENS'))));

    await expect(parser().parse(PDF)).rejects.toThrow('MAX_TOKENS');
  });

  describe('with a fallback model', () => {
    it('reads the document again with it when the first model was blocked as recitation', async () => {
      server.use(
        http.post(ENDPOINT, () =>
          HttpResponse.json({ candidates: [{ finishReason: 'RECITATION' }] })
        ),
        http.post(FALLBACK_ENDPOINT, () => HttpResponse.json(answer('# Gelesen')))
      );

      const result = await parser([], FALLBACK_MODEL).parse(PDF);

      expect(result.text).toBe('# Gelesen');
    });

    it('does not use it for other failures, which a second model would not fix', async () => {
      let fallbackCalls = 0;
      server.use(
        http.post(ENDPOINT, () => HttpResponse.json(answer('halber Text', 'MAX_TOKENS'))),
        http.post(FALLBACK_ENDPOINT, () => {
          fallbackCalls += 1;
          return HttpResponse.json(answer('x'));
        })
      );

      await expect(parser([], FALLBACK_MODEL).parse(PDF)).rejects.toThrow('MAX_TOKENS');
      expect(fallbackCalls).toBe(0);
    });

    it('fails with the reason when the fallback model does not finish either', async () => {
      server.use(
        http.post(ENDPOINT, () =>
          HttpResponse.json({ candidates: [{ finishReason: 'RECITATION' }] })
        ),
        http.post(FALLBACK_ENDPOINT, () => HttpResponse.json(answer('', 'SAFETY')))
      );

      await expect(parser([], FALLBACK_MODEL).parse(PDF)).rejects.toThrow('SAFETY');
    });

    it('says that the fallback model was tried when it is blocked too', async () => {
      server.use(
        http.post(ENDPOINT, () =>
          HttpResponse.json({ candidates: [{ finishReason: 'RECITATION' }] })
        ),
        http.post(FALLBACK_ENDPOINT, () =>
          HttpResponse.json({ candidates: [{ finishReason: 'RECITATION' }] })
        )
      );

      await expect(parser([], FALLBACK_MODEL).parse(PDF)).rejects.toThrow(
        /fallback model.*RECITATION/i
      );
    });
  });

  it('names the finish reason when the answer has no text parts at all', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          candidates: [{ content: { role: 'model' }, finishReason: 'MAX_TOKENS' }],
        })
      )
    );

    await expect(parser().parse(PDF)).rejects.toThrow('MAX_TOKENS');
  });

  it('gives up when the model does not answer within the time limit', async () => {
    server.use(
      http.post(ENDPOINT, async () => {
        await delay(500);
        return HttpResponse.json(answer('zu spät'));
      })
    );

    await expect(parser([], undefined, 20).parse(PDF)).rejects.toThrow(/time/i);
  });

  it('fails when the answer has no candidate at all', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.json({ promptFeedback: { blockReason: 'OTHER' } }))
    );

    await expect(parser().parse(PDF)).rejects.toThrow(/no candidate/i);
  });

  it('reports the status of a failed call', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({ error: { message: 'kaputt' } }, { status: 500 })
      )
    );

    await expect(parser().parse(PDF)).rejects.toBeInstanceOf(GeminiError);
  });
});
