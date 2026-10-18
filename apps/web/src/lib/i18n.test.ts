import { LOCALE } from '@nlm/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadWith(cookie: string, language: string) {
  document.cookie = cookie;
  vi.stubGlobal('navigator', { language });
  vi.resetModules();
  return import('./i18n');
}

describe('locale of the page', () => {
  afterEach(() => {
    document.cookie = 'nlm-locale=de';
    vi.unstubAllGlobals();
  });

  it('follows the cookie before the browser language', async () => {
    const i18n = await loadWith('nlm-locale=en', 'de-DE');
    expect(i18n.locale).toBe(LOCALE.EN);
    expect(i18n.tr('Hallo', 'Hello')).toBe('Hello');
  });

  it('falls back to the browser language, and to German for any other', async () => {
    document.cookie = 'nlm-locale=; max-age=0; path=/';
    expect((await loadWith('', 'en-US')).locale).toBe(LOCALE.EN);
    expect((await loadWith('', 'fr-FR')).locale).toBe(LOCALE.DE);
  });
});
