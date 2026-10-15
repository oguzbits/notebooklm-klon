import { describe, expect, it } from 'vitest';

import { GeminiError } from '../ai/gemini-error';
import type { QuestionResult } from './run';
import { isQuotaError, runAll } from './run-all';

function result(id: string): QuestionResult {
  return {
    id,
    language: 'de',
    answerable: true,
    retrieval: null,
    statements: [],
    answer: '',
    droppedStatements: 0,
    omittedStatements: [],
    strippedCitations: 0,
    factsInAnswer: null,
    factsInCitedChunks: null,
    abstained: null,
    repeatedStatements: 0,
    forbiddenFacts: [],
    answerWords: 0,
    failure: null,
    translateMs: 0,
    prepareMs: 0,
    firstStatementMs: null,
    totalMs: 0,
  };
}

const QUESTIONS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

/** `hits` lists the ids that hit the quota on their next `n` calls. */
function asker(hits: Record<string, number>) {
  const calls: string[] = [];
  const ask = async (question: { id: string }) => {
    calls.push(question.id);
    const remaining = hits[question.id] ?? 0;
    hits[question.id] = Math.max(0, remaining - 1);
    return { result: result(question.id), quotaHit: remaining > 0 };
  };
  return { ask, calls };
}

function options() {
  const sleeps: number[] = [];
  return {
    sleeps,
    pauseMs: 10,
    quotaWaitMs: 99,
    sleep: async (ms: number) => void sleeps.push(ms),
  };
}

describe('isQuotaError', () => {
  it('is true only for a 429 of the provider', () => {
    expect(isQuotaError(new GeminiError(429, 'x'))).toBe(true);
    expect(isQuotaError(new GeminiError(500, 'x'))).toBe(false);
    expect(isQuotaError(new Error('429'))).toBe(false);
  });
});

describe('runAll', () => {
  it('asks every question with a pause after each', async () => {
    const { ask } = asker({});
    const opts = options();

    const out = await runAll(QUESTIONS, ask, opts);

    expect(out.results.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(out.notAsked).toEqual([]);
    expect(opts.sleeps).toEqual([10, 10, 10]);
  });

  it('asks a question again after a quota hit that passes (per-minute limit)', async () => {
    const { ask, calls } = asker({ b: 1 });
    const opts = options();

    const out = await runAll(QUESTIONS, ask, opts);

    expect(calls).toEqual(['a', 'b', 'b', 'c']);
    expect(out.results.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(opts.sleeps).toContain(99);
  });

  it('stops at a quota that stays used up and leaves the rest unasked, not scored as failed', async () => {
    const { ask, calls } = asker({ b: 2 });

    const out = await runAll(QUESTIONS, ask, options());

    expect(out.results.map((r) => r.id)).toEqual(['a']);
    expect(out.notAsked).toEqual(['b', 'c']);
    expect(calls).toEqual(['a', 'b', 'b']);
  });
});
