import { formatDay } from './day';
import { INTL_LOCALE, locale, tr } from './i18n';

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 3600;
const DAY_S = 86_400;
const JUST_NOW_S = 45;
const DATE_AFTER_DAYS = 7;

const shortRelative = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], {
  numeric: 'always',
  style: 'short',
});
/** The words for today and yesterday, by how many days ago; older and future days get the date. */
const RECENT_DAYS: readonly string[] = [tr('Heute', 'Today'), tr('Gestern', 'Yesterday')];
const date = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: 'medium' });

/** "Vor 3 Min." for the list of the Studio; after a week the plain date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / SECOND_MS));
  if (seconds < JUST_NOW_S) return tr('Gerade eben', 'Just now');
  if (seconds < HOUR_S)
    return capitalize(shortRelative.format(-Math.round(seconds / MINUTE_S), 'minute'));
  if (seconds < DAY_S)
    return capitalize(shortRelative.format(-Math.round(seconds / HOUR_S), 'hour'));
  if (seconds < DATE_AFTER_DAYS * DAY_S) {
    return capitalize(shortRelative.format(-Math.round(seconds / DAY_S), 'day'));
  }
  return date.format(new Date(iso));
}

const clockFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
  hour: '2-digit',
  minute: '2-digit',
});

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

/** "Heute • 20:51" above a question: today, yesterday, or the plain date, with the time. */
export function messageTime(iso: string, now: Date = new Date()): string {
  const moment = new Date(iso);
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(moment).getTime()) / (DAY_S * SECOND_MS)
  );
  const day = RECENT_DAYS[days] ?? formatDay(moment);
  return `${day} • ${clockFormat.format(moment)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
