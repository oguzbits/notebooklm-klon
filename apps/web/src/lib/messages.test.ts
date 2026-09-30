import { API_ERROR, SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { AUTH_FAILURE } from './auth';
import { AUTH_MESSAGE, ERROR_MESSAGE, FAILURE_MESSAGE, STATUS_LABEL } from './messages';

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
