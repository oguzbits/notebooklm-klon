import { describe, expect, it } from 'vitest';

import { errorName } from './logger';

describe('errorName', () => {
  it('gives the name of an error, never its message', () => {
    expect(errorName(new TypeError('secret document text'))).toBe('TypeError');
  });

  it('says "unknown" for anything that is not an error', () => {
    expect(errorName('boom')).toBe('unknown');
    expect(errorName(undefined)).toBe('unknown');
  });
});
