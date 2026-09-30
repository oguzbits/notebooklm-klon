import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { GeminiError } from './gemini-error';
import { createGeminiPdfParser } from './gemini-pdf-parser';
import { RateLimiter } from './rate-limiter';

const MODEL = 'test-parse-model';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const KEY = 'test-key-not-real';
const PDF = new TextEncoder().encode('%PDF-1.4 fake');

const FALLBACK_MODEL = 'test-fallback-model';
const FALLBACK_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent`;

function parser(sleeps: number[] = [], fallbackModel?: string) {
  return createGeminiPdfParser({
    apiKey: KEY,
    model: MODEL,
    fallbackModel,
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

  it.each(['MAX_TOKENS', 'RECITATION', 'SAFETY', 'OTHER'])(
    'fails instead of returning a partial or blocked answer (%s)',
    async (finishReason) => {
      server.use(http.post(ENDPOINT, () => HttpResponse.json(answer('halber Text', finishReason))));

      await expect(parser().parse(PDF)).rejects.toThrow(finishReason);
    }
  );

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
