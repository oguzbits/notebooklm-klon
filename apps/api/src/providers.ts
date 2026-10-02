import { type ChatInput, createGeminiChat } from './ai/gemini-chat';
import { createGeminiEmbedder } from './ai/gemini-embedder';
import { createGeminiPdfParser } from './ai/gemini-pdf-parser';
import { RateLimiter, systemClock } from './ai/rate-limiter';
import type { Env } from './config/env';
import { PROVIDER_LIMITS } from './config/limits';
import { log } from './logger';
import { createParseSource } from './parsing/parse-source';

/**
 * The real AI providers, one per role, each behind the rate limiter of its role. The server, the
 * demo seed and the live eval all take their providers from here, so they cannot drift apart.
 */
export function createProviders(
  env: Pick<
    Env,
    'GEMINI_API_KEY' | 'AI_MODEL' | 'PARSE_MODEL' | 'PARSE_FALLBACK_MODEL' | 'EMBEDDING_MODEL'
  >
) {
  const provider = { apiKey: env.GEMINI_API_KEY, sleep: systemClock.sleep };
  const pdfParser = createGeminiPdfParser({
    ...provider,
    model: env.PARSE_MODEL,
    fallbackModel: env.PARSE_FALLBACK_MODEL,
    limiter: new RateLimiter(PROVIDER_LIMITS.PARSE),
  });
  const embedder = createGeminiEmbedder({
    ...provider,
    model: env.EMBEDDING_MODEL,
    limiter: new RateLimiter(PROVIDER_LIMITS.EMBED),
  });
  const chat = createGeminiChat({
    ...provider,
    model: env.AI_MODEL,
    limiter: new RateLimiter(PROVIDER_LIMITS.CHAT),
    onUsage: (usage) => log({ level: 'info', msg: 'chat usage', ...usage }),
  });

  return {
    parse: createParseSource(pdfParser),
    embedDocuments: (texts: string[]) => embedder.embedDocuments(texts),
    embedQuery: (text: string) => embedder.embedQuery(text),
    stream: (input: ChatInput) => chat.stream(input),
  };
}
