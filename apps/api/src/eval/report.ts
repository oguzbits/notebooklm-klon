import { OMISSION_REASON, type OmittedStatement } from '../chat/answer';
import type { EvalSummary, QuestionResult } from './run';

const MS_PER_SECOND = 1000;
const PERCENT = 100;

const percent = (value: number | null) =>
  value === null ? '–' : `${Math.round(value * PERCENT)} %`;
const seconds = (ms: number | null) =>
  ms === null ? '–' : `${(ms / MS_PER_SECOND).toFixed(1).replace('.', ',')} s`;

/** What stands out in an answer, in words for the report; empty when nothing does. */
function remarks(result: QuestionResult): string {
  const found: string[] = [];
  if (result.abstained === false) found.push('antwortet trotz fehlender Quelle');
  if (result.repeatedStatements > 0) found.push(`wiederholt: ${result.repeatedStatements}`);
  if (result.forbiddenFacts.length > 0) {
    found.push(`verbotene Angabe: ${result.forbiddenFacts.join(', ')}`);
  }
  return found.join('; ');
}

const OMISSION_LABEL = {
  [OMISSION_REASON.NOT_CITED]: 'ohne Zitat',
  [OMISSION_REASON.UNSUPPORTED_NUMBER]: 'Zahl nicht im Zitat',
  [OMISSION_REASON.REPEATED]: 'wiederholt',
} as const;

const omissionLine = (omitted: OmittedStatement) =>
  `  - ${OMISSION_LABEL[omitted.reason]}${omitted.numbers ? ` (${omitted.numbers.join(', ')})` : ''}: ${omitted.text}`;

/** The statements the server left out, per question. The text is document content: this is a report, not a log. */
function omissions(results: QuestionResult[]): string[] {
  const lines = results
    .filter((result) => result.omittedStatements.length > 0)
    .flatMap((result) => [`- ${result.id}`, ...result.omittedStatements.map(omissionLine)]);
  return lines.length === 0 ? [] : ['Weggelassene Aussagen:', ...lines, ''];
}

/** The result of a run as a Markdown table, for the terminal and for the report file. */
export function formatReport(results: QuestionResult[], summary: EvalSummary): string {
  const rows = results.map((result) =>
    [
      result.id,
      result.retrieval === null
        ? '–'
        : result.retrieval.hit
          ? `Rang ${result.retrieval.rank}`
          : 'Fehlt',
      percent(result.factsInAnswer),
      percent(result.factsInCitedChunks),
      `${result.droppedStatements} / ${result.strippedCitations}`,
      seconds(result.firstStatementMs),
      remarks(result),
      result.failure ?? '',
    ].join(' | ')
  );

  return [
    '| Frage | Suche | Fakten in Antwort | Fakten im Zitat | verworfen / entfernt | erste Aussage | Auffälligkeiten | Fehler |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
    '',
    ...omissions(results),
    `Fragen: ${summary.questions}`,
    `Trefferquote der Suche: ${percent(summary.retrievalHitRate)}`,
    `Fakten in der Antwort: ${percent(summary.factsInAnswer)}`,
    `Fakten im zitierten Abschnitt: ${percent(summary.factsInCitedChunks)}`,
    `Fragen ohne Antwort in den Quellen, richtig verweigert: ${percent(summary.abstentionRate)}`,
    `Wiederholte Aussagenpaare: ${summary.repeatedStatements}, verbotene Angaben: ${summary.forbiddenFacts}`,
    `Länge der Antwort (Wörter, Mittel): ${summary.meanAnswerWords === null ? '–' : Math.round(summary.meanAnswerWords)}`,
    `Vom Server verworfene Aussagen: ${summary.droppedStatements}, entfernte Zitate: ${summary.strippedCitations}`,
    `Fehlgeschlagene Antworten: ${summary.failures}`,
    `Zeit bis zur ersten Aussage (Median): ${seconds(summary.medianFirstStatementMs)}`,
  ].join('\n');
}
