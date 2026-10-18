import type { AnswerTrace } from '@nlm/shared';

import { tr } from './i18n';

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** What the search of the sources found, in words. */
export function foundLine(passagesFound: number): string {
  return passagesFound === 0
    ? tr('keine passende Textstelle gefunden', 'no matching passage found')
    : tr(
        `${plural(passagesFound, 'Textstelle', 'Textstellen')} gefunden`,
        `${plural(passagesFound, 'passage', 'passages')} found`
      );
}

/** What was left out of the answer and why, one line each; none when nothing was. */
export function leftOutLines(trace: AnswerTrace): string[] {
  const { droppedStatements, strippedCitations } = trace;
  const lines: string[] = [];
  if (droppedStatements > 0) {
    lines.push(
      tr(
        `${plural(droppedStatements, 'Aussage', 'Aussagen')} ohne Beleg ${droppedStatements === 1 ? 'wurde' : 'wurden'} weggelassen`,
        `${plural(droppedStatements, 'statement', 'statements')} without a source ${droppedStatements === 1 ? 'was' : 'were'} left out`
      )
    );
  }
  if (strippedCitations > 0) {
    lines.push(
      tr(
        `${plural(strippedCitations, 'ungültige Quellenangabe', 'ungültige Quellenangaben')} ${strippedCitations === 1 ? 'wurde' : 'wurden'} entfernt`,
        `${plural(strippedCitations, 'invalid citation', 'invalid citations')} ${strippedCitations === 1 ? 'was' : 'were'} removed`
      )
    );
  }
  return lines;
}
