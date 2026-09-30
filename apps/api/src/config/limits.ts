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
