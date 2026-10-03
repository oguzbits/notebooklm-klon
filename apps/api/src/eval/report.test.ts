import { API_ERROR } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

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
  strippedCitations: 0,
  factsInAnswer: 1,
  factsInCitedChunks: 0.5,
  abstained: null,
  repeatedStatements: 0,
  unsupportedNumbers: [],
  forbiddenFacts: [],
  answerWords: 1,
  failure: null,
  firstStatementMs: 1234,
  totalMs: 2000,
};

describe('formatReport', () => {
  it('has one row per question and a summary with the percentages', () => {
    const report = formatReport([result], summarize([result]));

    expect(report).toContain('nordlicht-lead');
    expect(report).toMatch(/Rang 2/);
    expect(report).toMatch(/100 %/);
    expect(report).toMatch(/50 %/);
    expect(report).toContain('1,2 s');
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

  it('names what stands out: an answer to an unanswerable question, repeats, numbers, forbidden facts', () => {
    const odd: QuestionResult = {
      ...result,
      id: 'ohne-quelle',
      answerable: false,
      retrieval: null,
      abstained: false,
      repeatedStatements: 1,
      unsupportedNumbers: ['12'],
      forbiddenFacts: ['5,9'],
    };

    const report = formatReport([odd], summarize([odd]));

    expect(report).toMatch(/ohne-quelle \| – /);
    expect(report).toContain('antwortet trotz fehlender Quelle');
    expect(report).toContain('wiederholt: 1');
    expect(report).toContain('Zahlen ohne Beleg: 12');
    expect(report).toContain('verbotene Angabe: 5,9');
    expect(report).toContain('richtig verweigert: 0 %');
  });
});
