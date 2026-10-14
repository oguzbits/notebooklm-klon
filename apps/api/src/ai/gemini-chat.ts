import { type USAGE_PURPOSE, USAGE_ROLE, type UsageEvent, type UsagePurpose } from '@nlm/shared';
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
        // Gemini leaves `parts` out when it produced no text, e.g. for MAX_TOKENS or RECITATION.
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
        finishReason: z.string().optional(),
      })
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      // Billed as output, but counted apart from the candidates.
      thoughtsTokenCount: z.number().optional(),
    })
    .optional(),
});

export interface GeminiChatConfig {
  apiKey: string;
  /** From the environment, never written in code. */
  model: string;
  limiter: RateLimiter;
  sleep: (ms: number) => Promise<void>;
  /** Longest wait for one attempt, answer body included. */
  timeoutMs?: number | undefined;
  /** Longest answer per purpose, sent with every request. */
  maxOutputTokens: Record<ChatPurpose, number>;
  /** Stores what a call cost. Awaited, so a failure to count is a failure of the call. */
  record: (event: UsageEvent) => Promise<void>;
}

/** The purposes that go through the chat model. */
type ChatPurpose = Exclude<UsagePurpose, typeof USAGE_PURPOSE.READ | typeof USAGE_PURPOSE.EMBED>;

export interface ChatInput {
  system: string;
  user: string;
  /** JSON Schema of the answer the model must produce. */
  schema: Record<string, unknown>;
  /** Whose call this is and what it is for: the cost is counted under it. */
  usage: { userId: string; purpose: ChatPurpose };
  /** Ends the request and the stream, e.g. when the reader leaves. */
  signal?: AbortSignal;
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

/** The request for one answer: the instruction, the question, and the shape the answer must have. */
function requestBody(input: ChatInput, maxOutputTokens: number) {
  return {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: 'user', parts: [{ text: input.user }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseJsonSchema: input.schema,
    },
  };
}

type Usage = { promptTokens: number; outputTokens: number };

type Event = z.infer<typeof EventSchema>;
type Candidate = NonNullable<Event['candidates']>[number];

/** True for a normal finish; any other reason (length, safety, recitation) is an error. */
function isNormalFinish(reason: string): true {
  if (reason !== FINISH_STOP) throw new Error(`The model did not finish normally: ${reason}.`);
  return true;
}

function usageOf(metadata: NonNullable<Event['usageMetadata']>): Usage {
  return {
    promptTokens: metadata.promptTokenCount ?? 0,
    outputTokens: (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0),
  };
}

/** The text of one event, which Gemini leaves out when it produced none (MAX_TOKENS, RECITATION). */
function textOf(candidate: Candidate | undefined): string {
  return (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
}

/**
 * What the events of one stream add up to: whether the model finished, whether the prompt was
 * blocked, and the token counts. An abnormal finish is an error at once; a stream that ends without a
 * normal finish is one in `conclude`.
 */
class StreamReport {
  private finished = false;
  private blocked: string | undefined;
  private usage: Usage | undefined;
  private chars = 0;

  /** Takes one event and returns the text it carries (possibly none). */
  read(event: Event): string {
    this.blocked ??= event.promptFeedback?.blockReason;
    const candidate = event.candidates?.[0];
    if (candidate?.finishReason !== undefined)
      this.finished = isNormalFinish(candidate.finishReason);
    if (event.usageMetadata) this.usage = usageOf(event.usageMetadata);
    const text = textOf(candidate);
    this.chars += text.length;
    return text;
  }

  /** The counts of the last event, or none when the provider reported none. */
  get reported(): Usage | undefined {
    return this.usage;
  }

  /** How much text the stream carried, for an estimate where no counts came. */
  get textChars(): number {
    return this.chars;
  }

  /** Call when the stream is over: it throws the reason there is no answer. */
  conclude(): void {
    if (this.blocked !== undefined && !this.finished) {
      throw new Error(`The prompt was blocked: ${this.blocked}.`);
    }
    if (!this.finished) throw new Error('The stream ended without a normal finish.');
  }
}

/**
 * Streams an answer as structured JSON text. The stream must end with a normal finish: an answer that
 * was cut off, blocked or filtered is an error, never a shorter answer.
 */
export function createGeminiChat(config: GeminiChatConfig) {
  return {
    async *stream(input: ChatInput): AsyncGenerator<string> {
      const estimatedTokens = Math.ceil(
        (input.system.length + input.user.length) / CHARS_PER_TOKEN
      );
      const response = await config.limiter.schedule(
        estimatedTokens,
        () =>
          requestGemini(
            config,
            `models/${config.model}:streamGenerateContent?alt=sse`,
            requestBody(input, config.maxOutputTokens[input.usage.purpose]),
            input.signal
          ),
        input.signal
      );
      if (!response.body) throw new Error('The model returned no stream.');

      const report = new StreamReport();
      try {
        for await (const line of lines(response.body)) {
          if (!line.startsWith(DATA_PREFIX)) continue;
          const text = report.read(EventSchema.parse(JSON.parse(line.slice(DATA_PREFIX.length))));
          if (text !== '') yield text;
        }
        report.conclude();
      } finally {
        // Counted on every way out: a cut-off or abandoned answer cost tokens too. The counts
        // arrive cumulatively in several events, so the last ones are the total.
        const usage = report.reported;
        await config.record({
          ...input.usage,
          role: USAGE_ROLE.CHAT,
          inputTokens: usage?.promptTokens ?? estimatedTokens,
          outputTokens: usage?.outputTokens ?? Math.ceil(report.textChars / CHARS_PER_TOKEN),
          estimated: usage === undefined,
        });
      }
    },
  };
}
