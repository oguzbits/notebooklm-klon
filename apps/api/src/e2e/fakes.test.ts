import { AnswerSchema } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { extractiveAnswer, hashEmbedding } from './fakes';

const DIMENSIONS = 16;

const cosine = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

describe('hashEmbedding', () => {
  it('is deterministic and has unit length', () => {
    const vector = hashEmbedding('Dr. Brandt leitet das Projekt Nordlicht', DIMENSIONS);

    expect(vector).toEqual(hashEmbedding('Dr. Brandt leitet das Projekt Nordlicht', DIMENSIONS));
    expect(vector).toHaveLength(DIMENSIONS);
    expect(Math.hypot(...vector)).toBeCloseTo(1);
  });

  it('puts texts with shared words closer together than unrelated ones', () => {
    const question = hashEmbedding('Wer leitet das Projekt Nordlicht?', DIMENSIONS);
    const related = hashEmbedding('Dr. Brandt leitet das Projekt Nordlicht.', DIMENSIONS);
    const unrelated = hashEmbedding('Die Bilanzsumme betrug elf Millionen Euro.', DIMENSIONS);

    expect(cosine(question, related)).toBeGreaterThan(cosine(question, unrelated));
  });

  it('gives a text without words a valid unit vector', () => {
    expect(Math.hypot(...hashEmbedding('  ', DIMENSIONS))).toBeCloseTo(1);
  });
});

describe('extractiveAnswer', () => {
  const message =
    '[c1]\nDr. Brandt leitet das Projekt. Es startete 2024.\n\n[c2]\nZweiter Absatz.\n\nQuestion: Wer?';

  it('answers with the first sentence of the best passages, each citing its label', () => {
    const answer = AnswerSchema.parse(JSON.parse(extractiveAnswer(message)));

    expect(answer.statements).toEqual([
      { text: 'Dr. Brandt leitet das Projekt.', chunkIds: ['c1'] },
      { text: 'Zweiter Absatz.', chunkIds: ['c2'] },
    ]);
  });

  it('says so without a citation when there is no passage', () => {
    const answer = AnswerSchema.parse(JSON.parse(extractiveAnswer('Question: Wer?')));

    expect(answer.statements).toHaveLength(1);
    expect(answer.statements[0]?.chunkIds).toEqual([]);
  });
});
