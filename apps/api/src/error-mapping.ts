import { API_ERROR, type ApiError } from '@nlm/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { GeminiError } from './ai/gemini-error';
import { NoSourcesSelectedError } from './chat/answer';
import { NotebookLimitReachedError, SourceLimitReachedError } from './core/notebook-limit';
import { EmptyStudioOutputError } from './core/studio-prompt';
import {
  DailyBudgetReachedError,
  RequestInProgressError,
  UsageLimitReachedError,
} from './core/usage-limit';
import { HTTP_STATUS } from './http-status';
import { ImportError } from './import/fetch-url';
import { UnreadablePdfError } from './parsing/pdf-pages';
import { WebSearchError } from './search/tavily-search';

export const errorBody = (
  code: ApiError['code'],
  detail?: string,
  requestId?: string
): ApiError => ({
  code,
  ...(detail === undefined ? {} : { detail }),
  ...(requestId === undefined ? {} : { requestId }),
});

type Mapped = { status: ContentfulStatusCode; body: ApiError };

/** The refusals of the limits: usage, the budget of the demo, a request in progress, notebooks and sources. */
function mapUsageError(error: Error): Mapped | null {
  if (error instanceof UsageLimitReachedError) {
    return {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      body: errorBody(API_ERROR.USAGE_LIMIT_REACHED, error.releaseAt.toISOString()),
    };
  }
  if (error instanceof DailyBudgetReachedError) {
    return {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      body: errorBody(API_ERROR.DAILY_BUDGET_REACHED),
    };
  }
  if (error instanceof RequestInProgressError) {
    return { status: HTTP_STATUS.CONFLICT, body: errorBody(API_ERROR.REQUEST_IN_PROGRESS) };
  }
  if (error instanceof NotebookLimitReachedError) {
    return { status: HTTP_STATUS.CONFLICT, body: errorBody(API_ERROR.NOTEBOOK_LIMIT_REACHED) };
  }
  if (error instanceof SourceLimitReachedError) {
    return { status: HTTP_STATUS.CONFLICT, body: errorBody(API_ERROR.SOURCE_LIMIT_REACHED) };
  }
  return null;
}

/**
 * The one place that turns a domain error into a status and an API code. Null for everything else:
 * that is a bug and stays a 500. A stream that has already sent its first byte cannot change its
 * status, so the chat stream reports its failures as events instead.
 */
export function mapError(error: Error): Mapped | null {
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
  const usage = mapUsageError(error);
  if (usage) return usage;
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
