import { API_ERROR } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { GeminiError } from './ai/gemini-error';
import { NoSourcesSelectedError } from './chat/answer';
import { EmptyStudioOutputError } from './core/studio-prompt';
import { mapError } from './error-mapping';
import { HTTP_STATUS } from './http-status';
import { IMPORT_ERROR, ImportError } from './import/fetch-url';
import { QuotaExceededError } from './ingestion/ingest';
import { UnreadablePdfError } from './parsing/pdf-pages';
import { WebSearchError } from './search/tavily-search';

describe('mapError', () => {
  it('maps every domain error to one status and code', () => {
    const cases = [
      [new QuotaExceededError(), HTTP_STATUS.TOO_MANY_REQUESTS, API_ERROR.UPLOAD_LIMIT_REACHED],
      [
        new GeminiError(HTTP_STATUS.TOO_MANY_REQUESTS, 'x'),
        HTTP_STATUS.TOO_MANY_REQUESTS,
        API_ERROR.CHAT_LIMIT_REACHED,
      ],
      [new NoSourcesSelectedError(), HTTP_STATUS.CONFLICT, API_ERROR.NO_SOURCES_SELECTED],
      [new EmptyStudioOutputError(), HTTP_STATUS.UNPROCESSABLE_ENTITY, API_ERROR.STUDIO_EMPTY],
      [
        new WebSearchError(HTTP_STATUS.TOO_MANY_REQUESTS, true),
        HTTP_STATUS.TOO_MANY_REQUESTS,
        API_ERROR.WEB_SEARCH_LIMIT_REACHED,
      ],
      [
        new UnreadablePdfError(new Error('broken')),
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
        API_ERROR.UNREADABLE_FILE,
      ],
    ] as const;

    for (const [error, status, code] of cases) {
      expect(mapError(error)).toEqual({ status, body: { code } });
    }
  });

  it('carries the import reason as the detail', () => {
    const mapped = mapError(new ImportError(IMPORT_ERROR.PRIVATE_ADDRESS, 'private'));
    expect(mapped).toEqual({
      status: HTTP_STATUS.BAD_REQUEST,
      body: { code: API_ERROR.INVALID_URL, detail: IMPORT_ERROR.PRIVATE_ADDRESS },
    });
  });

  it('leaves everything else to the generic handler', () => {
    expect(mapError(new Error('bug'))).toBeNull();
    expect(mapError(new GeminiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'x'))).toBeNull();
    expect(mapError(new WebSearchError(HTTP_STATUS.INTERNAL_SERVER_ERROR, false))).toBeNull();
  });
});
