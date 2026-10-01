const dayFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** A day as the original writes it on a card and under a title: "30.09.2026". */
export function formatDay(value: string | Date): string {
  return dayFormat.format(typeof value === 'string' ? new Date(value) : value);
}

const weekdayFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** A day as the divider of the chat writes it: "Mittwoch, 30. September". */
export function formatWeekday(value: string): string {
  return weekdayFormat.format(new Date(value));
}

/** Whether two moments fall on one calendar day of the reader. */
export function isSameDay(first: string, second: string): boolean {
  return new Date(first).toDateString() === new Date(second).toDateString();
}
