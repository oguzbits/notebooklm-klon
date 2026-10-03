import { API_ERROR } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { OMISSION_REASON } from '../chat/answer';
import { formatReport } from './report';
import type { QuestionResult } from './run';
import { summarize } from './run';

const result: QuestionResult = {
  id: 'nordlicht-lead',
  language: 'de',
  answerable: true,
  retrieval: { hit: true, rank: 2, anchorRecall: 1 },
  statements: [{ text: 'Brandt.', chunkIds: ['k'] }],
  answer: 'Brandt.',
  droppedStatements: 1,
  omittedStatements: [{ text: 'Ohne Beleg.', reason: OMISSION_REASON.NOT_CITED }],
  strippedCitations: 0,
  factsInAnswer: 1,
  factsInCitedChunks: 0.5,
  abstained: null,
  repeatedStatements: 0,
  forbiddenFacts: [],
  answerWords: 1,
  failure: null,
  translateMs: 1500,
  prepareMs: 2100,
  firstStatementMs: 3456,
  totalMs: 5000,
};

describe('formatReport', () => {
  it('has one row per question and a summary with the percentages', () => {
    const report = formatReport([result], summarize([result]));

    expect(report).toContain('nordlicht-lead');
    expect(report).toMatch(/Rang 2/);
    expect(report).toMatch(/100 %/);
    expect(report).toMatch(/50 %/);
    expect(report).toContain('3,5 s');
  });

  it('shows how long the preparation took and how much of it the translation', () => {
    const report = formatReport([result], summarize([result]));

    expect(report).toContain('2,1 s (davon Übersetzung 1,5 s)');
    expect(report).toContain(
      'Vorbereitung vor der Antwort (Median): 2,1 s, davon Übersetzung: 1,5 s'
    );
  });

  it('marks a miss, a failure and a ratio that does not apply', () => {
    const bad: QuestionResult = {
      ...result,
      id: 'kaputt',
      retrieval: { hit: false, rank: null, anchorRecall: 0 },
      factsInAnswer: null,
      failure: API_ERROR.INTERNAL,
      firstStatementMs: null,
    };

    const report = formatReport([bad], summarize([bad]));

    expect(report).toMatch(/kaputt.*Fehlt/);
    expect(report).toContain(API_ERROR.INTERNAL);
    expect(report).toContain('–');
  });

  it('names what stands out: an answer to an unanswerable question, repeats, forbidden facts', () => {
    const odd: QuestionResult = {
      ...result,
      id: 'ohne-quelle',
      answerable: false,
      retrieval: null,
      abstained: false,
      repeatedStatements: 1,
      forbiddenFacts: ['5,9'],
    };

    const report = formatReport([odd], summarize([odd]));

    expect(report).toMatch(/ohne-quelle \| – /);
    expect(report).toContain('antwortet trotz fehlender Quelle');
    expect(report).toContain('wiederholt: 1');
    expect(report).toContain('verbotene Angabe: 5,9');
    expect(report).toContain('richtig verweigert: 0 %');
  });

  it('lists what the server left out with its text and reason, under the table', () => {
    const odd: QuestionResult = {
      ...result,
      omittedStatements: [
        { text: 'Ohne Beleg.', reason: OMISSION_REASON.NOT_CITED },
        { text: 'Wuchs um 12 %.', reason: OMISSION_REASON.UNSUPPORTED_NUMBER, numbers: ['12'] },
        { text: 'Nochmal dasselbe.', reason: OMISSION_REASON.REPEATED },
      ],
    };

    const report = formatReport([odd], summarize([odd]));

    expect(report).toContain('nordlicht-lead');
    expect(report).toContain('Ohne Beleg.');
    expect(report).toContain('Wuchs um 12 %.');
    expect(report).toContain('12');
    expect(report).toContain('Nochmal dasselbe.');
    expect(report).toContain('ohne Zitat');
    expect(report).toContain('Zahl nicht im Zitat');
    expect(report).toContain('wiederholt');
  });

  it('has no list of omitted statements when the server left nothing out', () => {
    const clean: QuestionResult = { ...result, omittedStatements: [] };

    expect(formatReport([clean], summarize([clean]))).not.toContain('Weggelassene Aussagen');
  });
});
