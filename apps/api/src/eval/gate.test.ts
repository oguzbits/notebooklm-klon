import { describe, expect, it } from 'vitest';

import { type Baseline, compareToBaseline } from './gate';
import type { EvalSummary } from './run';

const BASELINE: Baseline = {
  date: '2026-10-15',
  questions: 34,
  retrievalHitRate: 1,
  factsInAnswer: 0.9,
  factsInCitedChunks: 1,
  abstentionRate: 1,
};

const summary = (changes: Partial<EvalSummary>): EvalSummary => ({
  questions: 34,
  retrievalHitRate: 1,
  meanHitRank: 1.8,
  factsInAnswer: 0.9,
  factsInCitedChunks: 1,
  abstentionRate: 1,
  repeatedStatements: 0,
  forbiddenFacts: 0,
  meanAnswerWords: 50,
  droppedStatements: 0,
  strippedCitations: 0,
  failures: 0,
  medianFirstStatementMs: 1,
  medianTranslateMs: 1,
  medianPrepareMs: 1,
  ...changes,
});

describe('compareToBaseline', () => {
  it('passes a run that equals or beats the baseline', () => {
    expect(compareToBaseline(summary({}), BASELINE)).toEqual([]);
    expect(compareToBaseline(summary({ factsInAnswer: 1 }), BASELINE)).toEqual([]);
  });

  it('passes a fall within the tolerance and names a fall beyond it', () => {
    expect(compareToBaseline(summary({ retrievalHitRate: 0.96 }), BASELINE)).toEqual([]);
    expect(compareToBaseline(summary({ retrievalHitRate: 0.9 }), BASELINE)).toEqual([
      'retrievalHitRate: 0.90 statt 1.00',
    ]);
  });

  it('ignores a measure that was not scored', () => {
    expect(compareToBaseline(summary({ abstentionRate: null }), BASELINE)).toEqual([]);
  });
});
