import { afterEach, describe, expect, it, vi } from 'vitest';

import { initTheme, readThemePreference, setThemePreference, THEME_PREFERENCE } from './theme';

function stubScheme(dark: boolean) {
  let listener: (event: { matches: boolean }) => void = () => {};
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      addEventListener: (_type: string, callback: typeof listener) => {
        listener = callback;
      },
    }))
  );
  return { change: (matches: boolean) => listener({ matches }) };
}

afterEach(() => {
  document.cookie = 'nlm-theme=; max-age=0; path=/';
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('initTheme', () => {
  it('turns the dark theme on when the system prefers it', () => {
    stubScheme(true);

    initTheme(document.documentElement);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('stays light when the system prefers light', () => {
    stubScheme(false);

    initTheme(document.documentElement);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the system when it changes while the app is open', () => {
    const system = stubScheme(false);
    initTheme(document.documentElement);

    system.change(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    system.change(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('the choice of the user', () => {
  it('reads system when nothing was chosen or the value is unknown', () => {
    expect(readThemePreference()).toBe(THEME_PREFERENCE.DEVICE);

    document.cookie = 'nlm-theme=PURPLE; path=/';
    expect(readThemePreference()).toBe(THEME_PREFERENCE.DEVICE);
  });

  it('is remembered and applied at once, against what the system prefers', () => {
    stubScheme(false);
    initTheme(document.documentElement);

    setThemePreference(THEME_PREFERENCE.DARK);
    expect(readThemePreference()).toBe(THEME_PREFERENCE.DARK);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    setThemePreference(THEME_PREFERENCE.LIGHT);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('keeps a fixed choice when the system changes, and follows the system again on request', () => {
    const system = stubScheme(false);
    initTheme(document.documentElement);
    setThemePreference(THEME_PREFERENCE.LIGHT);

    system.change(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    setThemePreference(THEME_PREFERENCE.DEVICE);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
