import { GUEST_LIMITS } from '@nlm/shared';

/**
 * Numeric limits of the application. Model IDs are not here: they come from the environment.
 * Free-tier provider limits are handled by the rate limiter, these are our own guard rails.
 */
export const LIMITS = {
  /** URL import: redirects followed before giving up. */
  URL_IMPORT_MAX_REDIRECTS: 5,
  /** URL import: total time for all hops together. */
  URL_IMPORT_TIMEOUT_MS: 15_000,
  /** URL import: largest response body accepted. */
  URL_IMPORT_MAX_BYTES: 5 * 1024 * 1024,
  /** Upload: largest file accepted. */
  UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
  /** Upload: most pages a PDF may have (each page costs provider quota). */
  UPLOAD_MAX_PDF_PAGES: 50,
  /** Quota: new sources one user may add within the window below. Re-uploading known content is free. */
  SOURCES_PER_USER_PER_WINDOW: 10,
  QUOTA_WINDOW_HOURS: 24,
  /** Chat: passages handed to the model per question. */
  CHAT_CONTEXT_CHUNKS: 8,
  /** Parsing: longest wait for one model to read a PDF. Without it a stalled call hangs for 5 min. */
  PARSE_TIMEOUT_MS: 120_000,
  /** Studio: characters of source text handed to the model per output (about 30k tokens). */
  STUDIO_MAX_CHARS: 120_000,
  /** Guests of the live demo: most that may be started within one hour, for everybody together. */
  GUESTS_PER_HOUR: 20,
  /** Guests of the live demo: most that may exist at the same time. */
  GUESTS_ALIVE: 200,
  /** Guests of the live demo: days until the account and its data are deleted. */
  GUEST_LIFETIME_DAYS: GUEST_LIMITS.LIFETIME_DAYS,
  /** Web search: searches one user may make per hour. */
  WEB_SEARCHES_PER_USER_PER_HOUR: 10,
  /** Web search: searches everybody together may make per day (the service gives 1000 credits a month). */
  WEB_SEARCHES_PER_DAY: 30,
  /** Web search: longest wait for the search service before the request gives up. */
  WEB_SEARCH_TIMEOUT_MS: 10_000,
  /** Ingestion: chunks per embedding request. */
  EMBED_BATCH_SIZE: 16,
} as const;

/**
 * Provider rate limits per role, from the Google AI Studio dashboard (free tier, 2026-09-30). The
 * limits belong to the model behind a role, so changing a model ID in the environment can mean
 * changing the row here. Read by the rate limiter that every LLM and embedding call goes through.
 */
export const PROVIDER_LIMITS = {
  PARSE: { requestsPerMinute: 15, tokensPerMinute: 250_000 },
  CHAT: { requestsPerMinute: 15, tokensPerMinute: 250_000 },
  EMBED: { requestsPerMinute: 100, tokensPerMinute: 30_000 },
} as const;
