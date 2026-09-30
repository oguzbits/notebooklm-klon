import type { EvalSummary, QuestionResult } from './run';

const MS_PER_SECOND = 1000;
const PERCENT = 100;

const percent = (value: number | null) =>
  value === null ? '–' : `${Math.round(value * PERCENT)} %`;
const seconds = (ms: number | null) =>
  ms === null ? '–' : `${(ms / MS_PER_SECOND).toFixed(1).replace('.', ',')} s`;

/** The result of a run as a Markdown table, for the terminal and for the report file. */
export function formatReport(results: QuestionResult[], summary: EvalSummary): string {
  const rows = results.map((result) =>
    [
      result.id,
      result.retrieval.hit ? `Rang ${result.retrieval.rank}` : 'Fehlt',
      percent(result.factsInAnswer),
      percent(result.factsInCitedChunks),
      `${result.droppedStatements} / ${result.strippedCitations}`,
      seconds(result.firstStatementMs),
      result.failure ?? '',
    ].join(' | ')
  );

  return [
    '| Frage | Suche | Fakten in Antwort | Fakten im Zitat | verworfen / entfernt | erste Aussage | Fehler |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
    '',
    `Fragen: ${summary.questions}`,
    `Trefferquote der Suche: ${percent(summary.retrievalHitRate)}`,
    `Fakten in der Antwort: ${percent(summary.factsInAnswer)}`,
    `Fakten im zitierten Abschnitt: ${percent(summary.factsInCitedChunks)}`,
    `Vom Server verworfene Aussagen: ${summary.droppedStatements}, entfernte Zitate: ${summary.strippedCitations}`,
    `Fehlgeschlagene Antworten: ${summary.failures}`,
    `Zeit bis zur ersten Aussage (Median): ${seconds(summary.medianFirstStatementMs)}`,
  ].join('\n');
}
