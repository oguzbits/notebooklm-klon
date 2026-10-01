import type { AnswerTrace } from '@nlm/shared';

export const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** What the search of the sources found, in words. */
export function foundLine(passagesFound: number): string {
  return passagesFound === 0
    ? 'keine passende Textstelle gefunden'
    : `${plural(passagesFound, 'Textstelle', 'Textstellen')} gefunden`;
}

/** What was left out of the answer and why, one line each; none when nothing was. */
export function leftOutLines(trace: AnswerTrace): string[] {
  const { droppedStatements, strippedCitations } = trace;
  const lines: string[] = [];
  if (droppedStatements > 0) {
    lines.push(
      `${plural(droppedStatements, 'Aussage', 'Aussagen')} ohne Beleg ${droppedStatements === 1 ? 'wurde' : 'wurden'} weggelassen`
    );
  }
  if (strippedCitations > 0) {
    lines.push(
      `${plural(strippedCitations, 'ungültige Quellenangabe', 'ungültige Quellenangaben')} ${strippedCitations === 1 ? 'wurde' : 'wurden'} entfernt`
    );
  }
  return lines;
}
