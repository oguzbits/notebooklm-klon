import { USAGE_WARNING_RATIO, type UsageLimit } from '@nlm/shared';

import { INTL_LOCALE, locale, tr } from './i18n';

/** The thing that is counted, in the words of the reader. */
export const LIMIT_WORDS = {
  CHAT: { one: tr('Frage', 'question'), many: tr('Fragen', 'questions') },
  STUDIO: { one: tr('Ausgabe', 'output'), many: tr('Ausgaben', 'outputs') },
} as const;

export const BUDGET_NOTE = tr(
  'Heute ist das Kontingent der Demo aufgebraucht. Morgen geht es weiter.',
  "Today's allowance for the demo is used up. It continues tomorrow."
);

const timeFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
  hour: '2-digit',
  minute: '2-digit',
});

/** "Ab 15:00 Uhr", or "Ab morgen 03:30 Uhr" when the time is not on the day of `now`. */
function sinceText(releaseAt: string, now: Date): string {
  const release = new Date(releaseAt);
  const sameDay = release.toDateString() === now.toDateString();
  const time = timeFormat.format(release);
  return tr(
    `Ab ${sameDay ? '' : 'morgen '}${time} Uhr`,
    `From ${sameDay ? '' : 'tomorrow '}${time}`
  );
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
    const when = releaseAt ? ` ${sinceText(releaseAt, now)}` : '';
    return {
      locked: true,
      note: releaseAt
        ? tr(
            `Das Limit ist erreicht.${when} geht es wieder.`,
            `The limit has been reached.${when} it works again.`
          )
        : tr('Das Limit ist erreicht.', 'The limit has been reached.'),
    };
  }
  if (used < limit * USAGE_WARNING_RATIO) return { locked: false, note: null };
  const left = limit - used;
  return {
    locked: false,
    note: tr(
      `Noch ${left} ${left === 1 ? words.one : words.many} heute.`,
      `${left} ${left === 1 ? words.one : words.many} left today.`
    ),
  };
}
