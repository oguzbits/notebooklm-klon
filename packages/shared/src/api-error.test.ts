import { describe, expect, it } from 'vitest';

import { API_ERROR, ApiErrorSchema } from './api-error';

describe('api error contract', () => {
  it('parses every error code of the dictionary and nothing else', () => {
    for (const code of Object.values(API_ERROR)) {
      expect(ApiErrorSchema.parse({ code })).toEqual({ code });
    }
    expect(ApiErrorSchema.safeParse({ code: 'SOMETHING_ELSE' }).success).toBe(false);
  });

  it('accepts an optional detail for a field-level hint', () => {
    expect(ApiErrorSchema.parse({ code: API_ERROR.INVALID_REQUEST, detail: 'title' })).toEqual({
      code: API_ERROR.INVALID_REQUEST,
      detail: 'title',
    });
  });

  it('rejects a body without a code', () => {
    expect(ApiErrorSchema.safeParse({}).success).toBe(false);
  });
});
