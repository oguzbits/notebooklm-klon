import { z } from 'zod';

/** Codes of every error the API answers with. The UI maps each code to a German message. */
export const API_ERROR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  /** The file has the right type but is damaged or protected: it cannot be opened. */
  UNREADABLE_FILE: 'UNREADABLE_FILE',
  TOO_MANY_PAGES: 'TOO_MANY_PAGES',
  NO_SOURCES_SELECTED: 'NO_SOURCES_SELECTED',
  CHAT_LIMIT_REACHED: 'CHAT_LIMIT_REACHED',
  INVALID_URL: 'INVALID_URL',
  /** The Studio could not support any part of its output with the sources. */
  STUDIO_EMPTY: 'STUDIO_EMPTY',
  /** No guest can be started now: no example to copy, or too many guests at the moment. */
  GUEST_UNAVAILABLE: 'GUEST_UNAVAILABLE',
  /** The web search is not set up in this installation. */
  WEB_SEARCH_UNAVAILABLE: 'WEB_SEARCH_UNAVAILABLE',
  /** Too many searches within the window. */
  WEB_SEARCH_LIMIT_REACHED: 'WEB_SEARCH_LIMIT_REACHED',
  /** Cover images are not set up in this installation (no object store). */
  COVER_UNAVAILABLE: 'COVER_UNAVAILABLE',
  /** The file is no PNG, JPEG or WebP image, or it is too large. */
  COVER_INVALID: 'COVER_INVALID',
  /** The source did not fail, or its original file is no longer kept: it cannot be read again. */
  SOURCE_NOT_RETRYABLE: 'SOURCE_NOT_RETRYABLE',
  INTERNAL: 'INTERNAL',
} as const;

export const ApiErrorCodeSchema = z.enum(API_ERROR);

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  /** Optional hint, for example the name of the field that was rejected. Never user content. */
  detail: z.string().optional(),
});

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
