import { z } from 'zod';

import { requestGemini } from './gemini-http';
import type { RateLimiter } from './rate-limiter';

const CHARS_PER_TOKEN = 3;
const FINISH_STOP = 'STOP';
const DATA_PREFIX = 'data:';

const EventSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional(),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
    })
    .optional(),
});

export interface GeminiChatConfig {
  apiKey: string;
  /** From the environment, never written in code. */
  model: string;
  limiter: RateLimiter;
  sleep: (ms: number) => Promise<void>;
  /** Receives the token counts of a finished answer, for the logs. */
  onUsage?: (usage: { promptTokens: number; outputTokens: number }) => void;
}

export interface ChatInput {
  system: string;
  user: string;
  /** JSON Schema of the answer the model must produce. */
  schema: Record<string, unknown>;
}

/** Lines of a server-sent event stream, whatever the network cut the chunks into. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      yield buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  buffer += decoder.decode();
  if (buffer !== '') yield buffer.replace(/\r$/, '');
}

/**
 * Streams an answer as structured JSON text. The stream must end with a normal finish: an answer that
 * was cut off, blocked or filtered is an error, never a shorter answer.
 */
export function createGeminiChat(config: GeminiChatConfig) {
  return {
    async *stream(input: ChatInput, signal?: AbortSignal): AsyncGenerator<string> {
      const estimatedTokens = Math.ceil(
        (input.system.length + input.user.length) / CHARS_PER_TOKEN
      );
      const response = await config.limiter.schedule(estimatedTokens, () =>
        requestGemini(
          config,
          `models/${config.model}:streamGenerateContent?alt=sse`,
          {
            systemInstruction: { parts: [{ text: input.system }] },
            contents: [{ role: 'user', parts: [{ text: input.user }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseJsonSchema: input.schema,
            },
          },
          signal
        )
      );
      if (!response.body) throw new Error('The model returned no stream.');

      let finished = false;
      let blocked: string | undefined;
      let usage: { promptTokens: number; outputTokens: number } | undefined;
      for await (const line of lines(response.body)) {
        if (!line.startsWith(DATA_PREFIX)) continue;
        const event = EventSchema.parse(JSON.parse(line.slice(DATA_PREFIX.length)));
        blocked ??= event.promptFeedback?.blockReason;
        const candidate = event.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
        if (text !== '') yield text;
        if (candidate?.finishReason !== undefined) {
          if (candidate.finishReason !== FINISH_STOP) {
            throw new Error(`The model did not finish normally: ${candidate.finishReason}.`);
          }
          finished = true;
        }
        if (event.usageMetadata) {
          usage = {
            promptTokens: event.usageMetadata.promptTokenCount ?? 0,
            outputTokens: event.usageMetadata.candidatesTokenCount ?? 0,
          };
        }
      }
      if (blocked !== undefined && !finished) {
        throw new Error(`The prompt was blocked: ${blocked}.`);
      }
      if (!finished) throw new Error('The stream ended without a normal finish.');
      // The counts arrive cumulatively in several events; report the last ones once.
      if (usage) config.onUsage?.(usage);
    },
  };
}
