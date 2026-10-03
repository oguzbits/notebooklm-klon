import { describe, expect, it } from 'vitest';

import { EvalDatasetSchema, type EvalQuestion, questionSourceFiles } from './dataset';

const question = {
  id: 'q1',
  question: 'Wie hoch ist der Umsatz?',
  language: 'de',
  expectedAnchors: [{ sourceFile: 'report.pdf', text: 'revenue grew by 12 %' }],
};

describe('EvalDatasetSchema', () => {
  it('accepts a question and defaults requiredFacts to an empty list', () => {
    const [parsed] = EvalDatasetSchema.parse([question]);

    expect(parsed?.requiredFacts).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const result = EvalDatasetSchema.safeParse([question, question]);

    expect(result.success).toBe(false);
  });

  it('accepts an unanswerable question that names its files and has no anchors', () => {
    const result = EvalDatasetSchema.safeParse([
      {
        id: 'q2',
        question: 'Wie hoch war der Umsatz 2031?',
        language: 'de',
        answerable: false,
        sourceFiles: ['report.pdf'],
      },
    ]);

    expect(result.success).toBe(true);
  });

  it.each([
    ['an answerable question without anchors', { expectedAnchors: [] }],
    ['an unanswerable question without files', { answerable: false, expectedAnchors: [] }],
    ['an unanswerable question with anchors', { answerable: false, sourceFiles: ['report.pdf'] }],
  ])('rejects %s', (_name, change) => {
    expect(EvalDatasetSchema.safeParse([{ ...question, ...change }]).success).toBe(false);
  });
});

describe('questionSourceFiles', () => {
  it('takes the files of the anchors once, or the named files of an unanswerable question', () => {
    const [answerable, unanswerable] = EvalDatasetSchema.parse([
      {
        ...question,
        expectedAnchors: [
          { sourceFile: 'a.pdf', text: 'x' },
          { sourceFile: 'a.pdf', text: 'y' },
          { sourceFile: 'b.pdf', text: 'z' },
        ],
      },
      { ...question, id: 'q2', answerable: false, expectedAnchors: [], sourceFiles: ['c.pdf'] },
    ]) as [EvalQuestion, EvalQuestion];

    expect(questionSourceFiles(answerable)).toEqual(['a.pdf', 'b.pdf']);
    expect(questionSourceFiles(unanswerable)).toEqual(['c.pdf']);
  });
});
