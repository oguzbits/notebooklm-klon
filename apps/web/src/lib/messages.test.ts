import { API_ERROR, SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { toRequestError } from './api';
import { AUTH_FAILURE } from './auth';
import {
  AUTH_MESSAGE,
  describeError,
  ERROR_MESSAGE,
  FAILURE_MESSAGE,
  STATUS_LABEL,
} from './messages';

// Words the user should never see (AGENTS.md rule 10).
const TECHNICAL_TERMS = /\b(RAG|Embedding|Chunk|Token|Vektor|API|Queue|Hash|SSRF|Parser)\b/i;

const allTexts = [
  ...Object.values(ERROR_MESSAGE),
  ...Object.values(FAILURE_MESSAGE),
  ...Object.values(STATUS_LABEL),
  ...Object.values(AUTH_MESSAGE),
];

describe('German copy', () => {
  it('has a text for every error code, failure, status and sign-in problem', () => {
    expect(Object.keys(ERROR_MESSAGE).sort()).toEqual(Object.values(API_ERROR).sort());
    expect(Object.keys(FAILURE_MESSAGE).sort()).toEqual(Object.values(SOURCE_FAILURE).sort());
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(Object.values(SOURCE_STATUS).sort());
    expect(Object.keys(AUTH_MESSAGE).sort()).toEqual(Object.values(AUTH_FAILURE).sort());
  });

  it('never shows a technical term', () => {
    for (const text of allTexts) {
      expect(text).not.toMatch(TECHNICAL_TERMS);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('describeError', () => {
  const answered = (code: string, requestId?: string) =>
    toRequestError(new Response(JSON.stringify({ code, requestId }), { status: 500 }));

  it('adds the short reference of an unexpected error, so it can be reported', async () => {
    const message = describeError(
      await answered(API_ERROR.INTERNAL, '3f2a9c1e-77aa-4c2e-9d11-0123456789ab')
    );

    expect(message).toBe(`${ERROR_MESSAGE[API_ERROR.INTERNAL]} Referenz: 3f2a9c1e`);
  });

  it('adds no reference to an error the message already explains', async () => {
    const message = describeError(await answered(API_ERROR.FILE_TOO_LARGE, 'abcdef123456'));

    expect(message).toBe(ERROR_MESSAGE[API_ERROR.FILE_TOO_LARGE]);
  });

  it('stays the plain message when the answer carries no ID', async () => {
    expect(describeError(await answered(API_ERROR.INTERNAL))).toBe(
      ERROR_MESSAGE[API_ERROR.INTERNAL]
    );
  });
});
