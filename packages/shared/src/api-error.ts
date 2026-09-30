import { z } from 'zod';

/** Codes of every error the API answers with. The UI maps each code to a German message. */
export const API_ERROR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  TOO_MANY_PAGES: 'TOO_MANY_PAGES',
  NO_SOURCES_SELECTED: 'NO_SOURCES_SELECTED',
  CHAT_LIMIT_REACHED: 'CHAT_LIMIT_REACHED',
  INVALID_URL: 'INVALID_URL',
  UPLOAD_LIMIT_REACHED: 'UPLOAD_LIMIT_REACHED',
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
