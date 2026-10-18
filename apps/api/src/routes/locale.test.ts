import { LOCALE, LOCALE_HEADER } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { requestLocale } from './locale';

const withHeader = (value: string | undefined) => ({
  req: { header: (name: string) => (name === LOCALE_HEADER ? value : undefined) },
});

describe('requestLocale', () => {
  it('reads the language the client sent', () => {
    expect(requestLocale(withHeader('en'))).toBe(LOCALE.EN);
  });

  it('falls back to German for a missing or unknown value', () => {
    expect(requestLocale(withHeader(undefined))).toBe(LOCALE.DE);
    expect(requestLocale(withHeader('fr'))).toBe(LOCALE.DE);
  });
});
