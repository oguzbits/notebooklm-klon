const dayFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** A day as the original writes it on a card and under a title: "30.09.2026". */
export function formatDay(value: string | Date): string {
  return dayFormat.format(typeof value === 'string' ? new Date(value) : value);
}
