import { USAGE_WARNING_RATIO, type UsageLimit } from '@nlm/shared';

/** The thing that is counted, in the words of the reader. */
export const LIMIT_WORDS = {
  CHAT: { one: 'Frage', many: 'Fragen' },
  STUDIO: { one: 'Ausgabe', many: 'Ausgaben' },
} as const;

export const BUDGET_NOTE = 'Heute ist das Kontingent der Demo aufgebraucht. Morgen geht es weiter.';

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** "Ab 15:00 Uhr", or "Ab morgen 03:30 Uhr" when the time is not on the day of `now`. */
function sinceText(releaseAt: string, now: Date): string {
  const release = new Date(releaseAt);
  const day = release.toDateString() === now.toDateString() ? '' : 'morgen ';
  return `Ab ${day}${timeFormat.format(release)} Uhr`;
}

/** What the reader sees of one limit: whether the control is locked, and the calm note, or none. */
export interface LimitNote {
  locked: boolean;
  note: string | null;
}

/**
 * The note for one limit. The daily budget of the demo locks everybody; the personal limit only
 * speaks from the warning threshold on, so that most readers never see a counter.
 */
export function describeLimit(
  status: { limit: UsageLimit; budgetReached: boolean } | undefined,
  words: { one: string; many: string },
  now: Date
): LimitNote {
  if (!status) return { locked: false, note: null };
  if (status.budgetReached) return { locked: true, note: BUDGET_NOTE };
  const { used, limit, releaseAt } = status.limit;
  if (used >= limit) {
    const when = releaseAt ? ` ${sinceText(releaseAt, now)} geht es wieder.` : '';
    return { locked: true, note: `Das Limit ist erreicht.${when}` };
  }
  if (used < limit * USAGE_WARNING_RATIO) return { locked: false, note: null };
  const left = limit - used;
  return { locked: false, note: `Noch ${left} ${left === 1 ? words.one : words.many} heute.` };
}
