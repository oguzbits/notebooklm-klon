/** How the app picks its colors: like the device, or fixed to light or dark. */
export const THEME_PREFERENCE = {
  DEVICE: 'DEVICE',
  LIGHT: 'LIGHT',
  DARK: 'DARK',
} as const;
export type ThemePreference = (typeof THEME_PREFERENCE)[keyof typeof THEME_PREFERENCE];

const DARK_CLASS = 'dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';
// A cookie, not local storage: it cannot throw when the browser blocks storage, and the choice is a
// convenience that must never break the page.
const COOKIE_NAME = 'nlm-theme';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const CHANGED_EVENT = 'nlm-theme-changed';

/** The preference a stored value stands for, or null for anything else. */
const asPreference = (value: string | undefined) =>
  Object.values(THEME_PREFERENCE).find((preference) => preference === value) ?? null;

export function readThemePreference(): ThemePreference {
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = entry?.slice(COOKIE_NAME.length + 1);
  return asPreference(value) ?? THEME_PREFERENCE.DEVICE;
}

/** Remembers the choice and applies it at once. */
export function setThemePreference(preference: ThemePreference): void {
  document.cookie = `${COOKIE_NAME}=${preference}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * Sets the dark theme on the root element by the choice of the user: fixed, or like the system, now
 * and whenever the system or the choice changes.
 */
export function initTheme(root: HTMLElement): void {
  const query = window.matchMedia(DARK_QUERY);
  let systemDark = query.matches;
  const apply = () => {
    const preference = readThemePreference();
    const dark =
      preference === THEME_PREFERENCE.DEVICE ? systemDark : preference === THEME_PREFERENCE.DARK;
    root.classList.toggle(DARK_CLASS, dark);
  };
  apply();
  query.addEventListener('change', (event) => {
    systemDark = event.matches;
    apply();
  });
  window.addEventListener(CHANGED_EVENT, apply);
}
