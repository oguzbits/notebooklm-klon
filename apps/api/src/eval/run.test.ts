import { API_ERROR } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import type { ChatInput } from '../ai/gemini-chat';
import type { EvalQuestion } from './dataset';
import { type EvalPorts, type QuestionResult, runQuestion, summarize } from './run';

const SCOPE = { userId: 'u', notebookId: 'n', sourceIds: ['s1'] };
const QUESTION: EvalQuestion = {
  id: 'nordlicht-lead',
  question: 'Wer leitet das Projekt Nordlicht?',
  language: 'de',
  answerable: true,
  expectedAnchors: [{ sourceFile: 'a.docx', text: 'von Dr. Katharina Brandt geleitet' }],
  requiredFacts: ['Katharina Brandt'],
  sourceFiles: [],
  forbiddenFacts: [],
};
const UNANSWERABLE: EvalQuestion = {
  ...QUESTION,
  id: 'nordlicht-sponsor',
  question: 'Wer ist der Sponsor von Projekt Nordlicht?',
  answerable: false,
  expectedAnchors: [],
  requiredFacts: [],
  sourceFiles: ['a.docx'],
  forbiddenFacts: ['Meier'],
};
const CHUNKS = [
  { id: 'k1', text: 'Das Budget beträgt viel.' },
  { id: 'k2', text: 'Das Projekt wird von Dr. Katharina Brandt geleitet.' },
];

/** Ports with a fixed search result and a model that replays the given JSON. */
function ports(reply: string, options: { fail?: boolean } = {}): EvalPorts {
  return {
    embedQuery: async () => [1],
    search: async () => CHUNKS,
    stream: async function* (_input: ChatInput) {
      yield reply;
      if (options.fail) throw new Error('boom');
    },
    onError: () => {},
  };
}

let clock = 0;
const now = () => (clock += 10);

describe('runQuestion', () => {
  it('scores retrieval, facts and citations of one answered question', async () => {
    const reply = JSON.stringify({
      statements: [{ text: 'Dr. Katharina Brandt leitet es.', chunkIds: ['c2'] }],
      followUps: [],
    });

    const result = await runQuestion(QUESTION, SCOPE, ports(reply), { topK: 2, now });

    expect(result.retrieval).toEqual({ hit: true, rank: 2, anchorRecall: 1 });
    expect(result.statements).toEqual([
      { text: 'Dr. Katharina Brandt leitet es.', chunkIds: ['k2'] },
    ]);
    expect(result.factsInAnswer).toBe(1);
    expect(result.factsInCitedChunks).toBe(1);
    expect(result.droppedStatements).toBe(0);
    expect(result.failure).toBeNull();
    expect(result.firstStatementMs).toBeGreaterThan(0);
  });

  it('counts what the server had to remove from the model answer', async () => {
    const reply = JSON.stringify({
      statements: [
        { text: 'Katharina Brandt.', chunkIds: ['c2', 'c9'] },
        { text: 'Ohne Beleg.', chunkIds: [] },
      ],
      followUps: [],
    });

    const result = await runQuestion(QUESTION, SCOPE, ports(reply), { topK: 2, now });

    expect(result.strippedCitations).toBe(1);
    expect(result.droppedStatements).toBe(1);
    expect(result.statements).toHaveLength(1);
  });

  it('finds facts in the answer but not in the cited passage when the citation is wrong', async () => {
    const reply = JSON.stringify({
      statements: [{ text: 'Katharina Brandt leitet es.', chunkIds: ['c1'] }],
      followUps: [],
    });

    const result = await runQuestion(QUESTION, SCOPE, ports(reply), { topK: 2, now });

    expect(result.factsInAnswer).toBe(1);
    expect(result.factsInCitedChunks).toBe(0);
  });

  it('records a failure of the model and keeps the statements before it', async () => {
    const reply = '{"statements":[{"text":"Eins.","chunkIds":["c2"]},';

    const result = await runQuestion(QUESTION, SCOPE, ports(reply, { fail: true }), {
      topK: 2,
      now,
    });

    expect(result.failure).toBe(API_ERROR.INTERNAL);
    expect(result.statements).toHaveLength(1);
  });
});

describe('runQuestion with a question the sources cannot answer', () => {
  it('counts the refusal as abstention: the server keeps no statement without a citation', async () => {
    const reply = JSON.stringify({
      statements: [{ text: 'Dazu steht nichts in den Quellen.', chunkIds: [] }],
      followUps: [],
    });

    const result = await runQuestion(UNANSWERABLE, SCOPE, ports(reply), { topK: 2, now });

    expect(result.abstained).toBe(true);
    expect(result.retrieval).toBeNull();
    expect(result.droppedStatements).toBe(1);
  });

  it('flags an answer with a citation and the forbidden fact in it', async () => {
    const reply = JSON.stringify({
      statements: [{ text: 'Sponsor ist Herr Meier.', chunkIds: ['c2'] }],
      followUps: [],
    });

    const result = await runQuestion(UNANSWERABLE, SCOPE, ports(reply), { topK: 2, now });

    expect(result.abstained).toBe(false);
    expect(result.forbiddenFacts).toEqual(['Meier']);
  });

  it('does not call a failed answer a refusal', async () => {
    const result = await runQuestion(UNANSWERABLE, SCOPE, ports('', { fail: true }), {
      topK: 2,
      now,
    });

    expect(result.abstained).toBe(false);
    expect(result.failure).toBe(API_ERROR.INTERNAL);
  });
});

describe('runQuestion quality signals', () => {
  it('reports numbers that no cited passage contains and the length of the answer', async () => {
    const reply = JSON.stringify({
      statements: [{ text: 'Katharina Brandt leitet es seit 2019.', chunkIds: ['c2'] }],
      followUps: [],
    });

    const result = await runQuestion(QUESTION, SCOPE, ports(reply), { topK: 2, now });

    expect(result.unsupportedNumbers).toEqual(['2019']);
    expect(result.answerWords).toBe(6);
  });
});

describe('summarize', () => {
  const base: QuestionResult = {
    id: 'a',
    language: 'de',
    answerable: true,
    retrieval: { hit: true, rank: 1, anchorRecall: 1 },
    statements: [],
    answer: '',
    droppedStatements: 0,
    strippedCitations: 0,
    factsInAnswer: 1,
    factsInCitedChunks: 1,
    abstained: null,
    repeatedStatements: 0,
    unsupportedNumbers: [],
    forbiddenFacts: [],
    answerWords: 10,
    failure: null,
    firstStatementMs: 100,
    totalMs: 200,
  };

  it('averages the ratios, skips questions where a ratio does not apply and adds the counts', () => {
    const summary = summarize([
      base,
      {
        ...base,
        id: 'b',
        retrieval: { hit: false, rank: null, anchorRecall: 0 },
        factsInAnswer: 0.5,
        factsInCitedChunks: null,
        droppedStatements: 2,
        strippedCitations: 1,
        firstStatementMs: 300,
      },
    ]);

    expect(summary).toMatchObject({
      questions: 2,
      retrievalHitRate: 0.5,
      meanHitRank: 1,
      factsInAnswer: 0.75,
      factsInCitedChunks: 1,
      droppedStatements: 2,
      strippedCitations: 1,
      failures: 0,
      medianFirstStatementMs: 200,
    });
  });

  it('keeps unanswerable questions out of retrieval and length, and rates the refusals', () => {
    const refused = {
      ...base,
      id: 'r',
      answerable: false,
      retrieval: null,
      abstained: true,
      answerWords: 0,
    };
    const answered = {
      ...refused,
      id: 's',
      abstained: false,
      repeatedStatements: 2,
      unsupportedNumbers: ['1', '2'],
      forbiddenFacts: ['x'],
    };

    const summary = summarize([base, refused, answered]);

    expect(summary).toMatchObject({
      retrievalHitRate: 1,
      meanAnswerWords: 10,
      abstentionRate: 0.5,
      repeatedStatements: 2,
      unsupportedNumbers: 2,
      forbiddenFacts: 1,
    });
  });

  it('gives nulls for an empty run instead of dividing by zero', () => {
    expect(summarize([])).toMatchObject({
      questions: 0,
      retrievalHitRate: null,
      factsInAnswer: null,
      medianFirstStatementMs: null,
    });
  });
});
