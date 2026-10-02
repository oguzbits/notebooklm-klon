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
 * Reads a PDF or an image, scans included, with a Gemini model. An answer that did not end normally (cut off,
 * blocked as recitation, filtered) is an error: partial text would silently lose content.
 */
export function createGeminiPdfParser(config: GeminiPdfParserConfig) {
  async function transcribe(model: string, bytes: Uint8Array, mimeType: string, prompt: string) {
    const estimatedTokens = Math.ceil(bytes.length / BYTES_PER_TOKEN) + PROMPT_TOKENS;
    const json = await config.limiter.schedule(estimatedTokens, () =>
      postGemini(
        config,
        `models/${model}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: Buffer.from(bytes).toString('base64'),
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        },
        AbortSignal.timeout(config.timeoutMs ?? LIMITS.PARSE_TIMEOUT_MS)
      )
    );
    const [candidate] = ResponseSchema.parse(json).candidates ?? [];
    if (!candidate) throw new Error('The model returned no candidate.');
    return candidate;
  }

  async function read(
    bytes: Uint8Array,
    mimeType: string,
    prompt: string
  ): Promise<ParsedDocument> {
    let candidate = await transcribe(config.model, bytes, mimeType, prompt);
    let fallbackTried = false;
    if (candidate.finishReason === FINISH_RECITATION && config.fallbackModel) {
      candidate = await transcribe(config.fallbackModel, bytes, mimeType, prompt);
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

  return {
    parse: (bytes: Uint8Array) => read(bytes, PDF_MIME_TYPE, PDF_PROMPT),
    parseImage: (bytes: Uint8Array, mimeType: string) => read(bytes, mimeType, IMAGE_PROMPT),
  };
}
