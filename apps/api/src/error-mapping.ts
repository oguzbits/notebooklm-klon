import { API_ERROR, type ApiError } from '@nlm/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { GeminiError } from './ai/gemini-error';
import { NoSourcesSelectedError } from './chat/answer';
import { EmptyStudioOutputError } from './core/studio-prompt';
import { HTTP_STATUS } from './http-status';
import { ImportError } from './import/fetch-url';
import { QuotaExceededError } from './ingestion/ingest';
import { UnreadablePdfError } from './parsing/pdf-pages';
import { WebSearchError } from './search/tavily-search';

export const errorBody = (code: ApiError['code'], detail?: string): ApiError =>
  detail === undefined ? { code } : { code, detail };

type Mapped = { status: ContentfulStatusCode; body: ApiError };

/**
 * The one place that turns a domain error into a status and an API code. Null for everything else:
 * that is a bug and stays a 500. A stream that has already sent its first byte cannot change its
 * status, so the chat stream reports its failures as events instead.
 */
export function mapError(error: Error): Mapped | null {
  if (error instanceof QuotaExceededError) {
    return {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      body: errorBody(API_ERROR.UPLOAD_LIMIT_REACHED),
    };
  }
  if (error instanceof ImportError) {
    return { status: HTTP_STATUS.BAD_REQUEST, body: errorBody(API_ERROR.INVALID_URL, error.code) };
  }
  if (error instanceof GeminiError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return { status: HTTP_STATUS.TOO_MANY_REQUESTS, body: errorBody(API_ERROR.CHAT_LIMIT_REACHED) };
  }
  if (error instanceof WebSearchError && error.quotaExhausted) {
    return {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      body: errorBody(API_ERROR.WEB_SEARCH_LIMIT_REACHED),
    };
  }
  if (error instanceof NoSourcesSelectedError) {
    return { status: HTTP_STATUS.CONFLICT, body: errorBody(API_ERROR.NO_SOURCES_SELECTED) };
  }
  if (error instanceof EmptyStudioOutputError) {
    return { status: HTTP_STATUS.UNPROCESSABLE_ENTITY, body: errorBody(API_ERROR.STUDIO_EMPTY) };
  }
  if (error instanceof UnreadablePdfError) {
    return {
      status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      body: errorBody(API_ERROR.UNREADABLE_FILE),
    };
  }
  return null;
}
