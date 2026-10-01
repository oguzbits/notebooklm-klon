import type { Flashcards } from '@nlm/shared';

import { toCsv } from './csv';
import { download } from './download';

/** The set as a CSV file (front, back) named after the output. */
export function downloadFlashcards(title: string, cards: Flashcards['cards']): void {
  const csv = toCsv(
    ['Vorderseite', 'Rückseite'],
    cards.map((entry) => [entry.front, entry.back])
  );
  download(`${title}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
