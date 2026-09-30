const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86_400;
const JUST_NOW_S = 45;
const DATE_AFTER_DAYS = 7;

const shortRelative = new Intl.RelativeTimeFormat('de', { numeric: 'always', style: 'short' });
const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

/** "Vor 3 Min." for the list of the Studio; after a week the plain date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / SECOND_MS));
  if (seconds < JUST_NOW_S) return 'Gerade eben';
  if (seconds < HOUR_S)
    return capitalize(shortRelative.format(-Math.round(seconds / MINUTE_S), 'minute'));
  if (seconds < DAY_S)
    return capitalize(shortRelative.format(-Math.round(seconds / HOUR_S), 'hour'));
  if (seconds < DATE_AFTER_DAYS * DAY_S) {
    return capitalize(shortRelative.format(-Math.round(seconds / DAY_S), 'day'));
  }
  return date.format(new Date(iso));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
