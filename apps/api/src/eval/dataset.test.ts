import { describe, expect, it } from 'vitest';

import { EvalDatasetSchema } from './dataset';

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

  it('rejects a question without an expected anchor', () => {
    expect(EvalDatasetSchema.safeParse([{ ...question, expectedAnchors: [] }]).success).toBe(false);
  });

  it('rejects an unknown language', () => {
    expect(EvalDatasetSchema.safeParse([{ ...question, language: 'fr' }]).success).toBe(false);
  });
});
