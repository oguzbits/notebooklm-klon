import { z } from 'zod';

import { LIMITS } from '../config/limits';
import type { ParsedDocument } from '../ingestion/ingest';
import { postGemini } from './gemini-http';
import type { RateLimiter } from './rate-limiter';

const FINISH_STOP = 'STOP';
const FINISH_RECITATION = 'RECITATION';
// Measured in the model spike: about 20 bytes of PDF per input token, plus the prompt.
const BYTES_PER_TOKEN = 15;
const PROMPT_TOKENS = 500;
// Audio costs 32 tokens per second. An MP3 has about 16 kB per second, a WAV far more, so 125 bytes
// per token over-estimates a little, which is the safe side for the rate limiter.
const AUDIO_BYTES_PER_TOKEN = 125;

const PDF_MIME_TYPE = 'application/pdf';

const PDF_PROMPT =
  'Transcribe this document completely into Markdown. Keep the reading order (for two-column ' +
  'pages read the left column first). Render tables as Markdown tables. Do not summarize, ' +
  'translate, omit or add anything. If a page is a scan, read the text as printed. Output only ' +
  'the transcription.';

const IMAGE_PROMPT =
  'Transcribe all text in this image completely into Markdown, in reading order. Render tables ' +
  'as Markdown tables. Do not summarize, translate, omit or add anything. If the image contains ' +
  'no text, describe in two or three plain sentences what it shows. Output only the result.';

const AUDIO_PROMPT =
  'Transcribe the speech in this recording completely and word for word, in the language spoken. ' +
  'Start a new paragraph when the speaker changes or the topic does, and mark a change of ' +
  'speaker with a label such as "Sprecher 1:". Do not summarize, translate, omit or add ' +
  'anything. If there is no speech, describe in two or three plain sentences what can be heard. ' +
  'Output only the result.';

const VIDEO_PROMPT =
  'Transcribe the speech in this video completely and word for word, in the language spoken. ' +
  'Start a new paragraph when the speaker changes or the topic does, and mark a change of ' +
  'speaker with a label such as "Sprecher 1:". Do not summarize, translate, omit or add ' +
  'anything. If there is no speech, describe in two or three plain sentences what the video ' +
  'shows and what can be heard. Output only the result.';

/** What differs between the kinds of input: the prompt, the cost per byte and the wait. */
interface Reading {
  prompt: string;
  bytesPerToken: number;
  timeoutMs: number;
}

const PDF_READING: Reading = {
  prompt: PDF_PROMPT,
  bytesPerToken: BYTES_PER_TOKEN,
  timeoutMs: LIMITS.PARSE_TIMEOUT_MS,
};
const IMAGE_READING: Reading = { ...PDF_READING, prompt: IMAGE_PROMPT };
const AUDIO_READING: Reading = {
  prompt: AUDIO_PROMPT,
  bytesPerToken: AUDIO_BYTES_PER_TOKEN,
  timeoutMs: LIMITS.AUDIO_PARSE_TIMEOUT_MS,
};

// The model fetches a video itself, so the server never sees its length. It takes as long as a
// recording, and the limiter is told the length the limit assumes.
const VIDEO_READING: Reading = { ...AUDIO_READING, prompt: VIDEO_PROMPT };

/** What goes to the model: the part with the input and the tokens it is expected to cost. */
interface Input {
  part: Record<string, unknown>;
  tokens: number;
}

const ResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        // Gemini leaves `parts` out when it produced no text, e.g. for MAX_TOKENS or RECITATION.
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
});

export interface GeminiPdfParserConfig {
  apiKey: string;
  /** From the environment, never written in code. */
  model: string;
  /**
   * Read again with this model when the first one was blocked as recitation, which some scans of
   * well-known documents trigger. Also from the environment. Unset: the block is an error.
   */
  fallbackModel?: string | undefined;
  limiter: RateLimiter;
  /** Longest wait for one model call. Defaults to the limit in the config. */
  timeoutMs?: number | undefined;
  sleep: (ms: number) => Promise<void>;
}

/**
 * Reads a PDF, an image (scans included), a recording or a YouTube video with a Gemini model. An answer that did not end normally (cut off,
 * blocked as recitation, filtered) is an error: partial text would silently lose content.
 */
export function createGeminiPdfParser(config: GeminiPdfParserConfig) {
  async function transcribe(model: string, input: Input, reading: Reading) {
    const json = await config.limiter.schedule(input.tokens, () =>
      postGemini(
        config,
        `models/${model}:generateContent`,
        {
          contents: [
            {
              parts: [input.part, { text: reading.prompt }],
            },
          ],
          generationConfig: { temperature: 0 },
        },
        AbortSignal.timeout(config.timeoutMs ?? reading.timeoutMs)
      )
    );
    const [candidate] = ResponseSchema.parse(json).candidates ?? [];
    if (!candidate) throw new Error('The model returned no candidate.');
    return candidate;
  }

  async function read(input: Input, reading: Reading): Promise<ParsedDocument> {
    let candidate = await transcribe(config.model, input, reading);
    let fallbackTried = false;
    if (candidate.finishReason === FINISH_RECITATION && config.fallbackModel) {
      candidate = await transcribe(config.fallbackModel, input, reading);
      fallbackTried = true;
    }
    if (candidate.finishReason !== FINISH_STOP) {
      throw new Error(
        `The ${fallbackTried ? 'fallback ' : ''}model did not finish normally: ` +
          `${candidate.finishReason ?? 'unknown'}.`
      );
    }
    const text = (candidate.content?.parts ?? []).map((part) => part.text ?? '').join('');
    return { text, pageCount: null };
  }

  const inline = (bytes: Uint8Array, mimeType: string, reading: Reading): Input => ({
    part: { inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } },
    tokens: Math.ceil(bytes.length / reading.bytesPerToken) + PROMPT_TOKENS,
  });

  return {
    parse: (bytes: Uint8Array) => read(inline(bytes, PDF_MIME_TYPE, PDF_READING), PDF_READING),
    parseImage: (bytes: Uint8Array, mimeType: string) =>
      read(inline(bytes, mimeType, IMAGE_READING), IMAGE_READING),
    parseAudio: (bytes: Uint8Array, mimeType: string) =>
      read(inline(bytes, mimeType, AUDIO_READING), AUDIO_READING),
    /** A public YouTube link: Gemini fetches and watches the video, our server never does. */
    parseVideoUrl: (url: string) =>
      read(
        {
          part: { fileData: { fileUri: url } },
          tokens: LIMITS.VIDEO_ESTIMATED_TOKENS + PROMPT_TOKENS,
        },
        VIDEO_READING
      ),
  };
}
