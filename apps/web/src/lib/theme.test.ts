import { afterEach, describe, expect, it, vi } from 'vitest';

import { followColorScheme } from './theme';

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
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('followColorScheme', () => {
  it('turns the dark theme on when the system prefers it', () => {
    stubScheme(true);

    followColorScheme(document.documentElement);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('stays light when the system prefers light', () => {
    stubScheme(false);

    followColorScheme(document.documentElement);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows the system when it changes while the app is open', () => {
    const system = stubScheme(false);
    followColorScheme(document.documentElement);

    system.change(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    system.change(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
