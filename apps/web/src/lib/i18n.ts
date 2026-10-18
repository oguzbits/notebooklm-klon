import { LOCALE, type Locale } from '@nlm/shared';

// A cookie like the theme: it cannot throw when storage is blocked. A change reloads the page, so
// every text is picked once at load and module-level constants need no hook.
const COOKIE_NAME = 'nlm-locale';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const asLocale = (value: string | undefined) =>
  Object.values(LOCALE).find((locale) => locale === value) ?? null;

function detectLocale(): Locale {
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const chosen = asLocale(entry?.slice(COOKIE_NAME.length + 1));
  if (chosen) return chosen;
  return navigator.language.toLowerCase().startsWith(LOCALE.EN) ? LOCALE.EN : LOCALE.DE;
}

/** The language of this page load. */
export const locale: Locale = detectLocale();

/** The text for the language of the page: both versions are written side by side at the call site. */
export const tr = (de: string, en: string): string => (locale === LOCALE.EN ? en : de);

/** BCP 47 tag for `Intl`. */
export const INTL_LOCALE: Record<Locale, string> = { [LOCALE.DE]: 'de-DE', [LOCALE.EN]: 'en-GB' };

/** Remembers the choice and reloads, so that every text switches. */
export function setLocale(next: Locale): void {
  document.cookie = `${COOKIE_NAME}=${next}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
  window.location.reload();
}
