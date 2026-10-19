import { USAGE_PURPOSE, type UsageEvent } from '@nlm/shared';

import { type ChatInput, createGeminiChat } from './ai/gemini-chat';
import { createGeminiEmbedder } from './ai/gemini-embedder';
import { createGeminiPdfParser } from './ai/gemini-pdf-parser';
import { RateLimiter, systemClock } from './ai/rate-limiter';
import type { Env } from './config/env';
import { LIMITS, MAX_OUTPUT_TOKENS, PROVIDER_LIMITS } from './config/limits';
import {
  parseTranslations,
  TRANSLATE_JSON_SCHEMA,
  TRANSLATE_SYSTEM_PROMPT,
} from './core/query-variants';
import { createParseSource } from './parsing/parse-source';

/**
 * The real AI providers, one per role, each behind the rate limiter of its role. The server, the
 * demo seed and the live eval all take their providers from here, so they cannot drift apart.
 */
export function createProviders(
  env: Pick<
    Env,
    'GEMINI_API_KEY' | 'AI_MODEL' | 'PARSE_MODEL' | 'PARSE_FALLBACK_MODEL' | 'EMBEDDING_MODEL'
  >,
  /** Stores what each call cost, under the user it was made for. */
  record: (event: UsageEvent) => Promise<void>
) {
  const provider = { apiKey: env.GEMINI_API_KEY, sleep: systemClock.sleep, record };
  const documentParser = createGeminiPdfParser({
    ...provider,
    model: env.PARSE_MODEL,
    fallbackModel: env.PARSE_FALLBACK_MODEL,
    maxOutputTokens: MAX_OUTPUT_TOKENS[USAGE_PURPOSE.READ],
    limiter: new RateLimiter(PROVIDER_LIMITS.PARSE),
  });
  const embedder = createGeminiEmbedder({
    ...provider,
    model: env.EMBEDDING_MODEL,
    timeoutMs: LIMITS.EMBED_TIMEOUT_MS,
    limiter: new RateLimiter(PROVIDER_LIMITS.EMBED),
  });
  const chat = createGeminiChat({
    ...provider,
    model: env.AI_MODEL,
    timeoutMs: LIMITS.CHAT_TIMEOUT_MS,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    limiter: new RateLimiter(PROVIDER_LIMITS.CHAT),
  });

  const stream = (input: ChatInput) => chat.stream(input);
  const translateQuery = async (text: string, userId: string): Promise<string[]> => {
    let reply = '';
    for await (const piece of stream({
      system: TRANSLATE_SYSTEM_PROMPT,
      user: text,
      schema: TRANSLATE_JSON_SCHEMA,
      usage: { userId, purpose: USAGE_PURPOSE.QUESTION_PREP },
    })) {
      reply += piece;
    }
    return parseTranslations(reply);
  };

  return {
    embeddingModel: env.EMBEDDING_MODEL,
    parse: createParseSource(documentParser),
    embedDocuments: (texts: string[], userId: string) => embedder.embedDocuments(texts, userId),
    embedQuery: (text: string, userId: string) => embedder.embedQuery(text, userId),
    translateQuery,
    stream,
  };
}
