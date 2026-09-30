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
  /** Ingestion: chunks per embedding request. */
  EMBED_BATCH_SIZE: 16,
} as const;
