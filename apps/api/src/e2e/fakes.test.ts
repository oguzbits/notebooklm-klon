import {
  AnswerSchema,
  CHAT_LANGUAGE,
  FlashcardsReplySchema,
  MindmapSchema,
  QuizReplySchema,
  REPORT_FORMAT,
  ReportSchema,
  SourceOverviewSchema,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
} from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { studioRequest } from '../core/studio-prompt';
import { extractiveAnswer, fakeOverview, fakeStudio, hashEmbedding } from './fakes';

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

describe('fakeOverview', () => {
  const message =
    'Document title: nordlicht.txt\n\nDr. Brandt leitet das Projekt Nordlicht. Das Projekt untersucht Polarlicht. Das Budget beträgt viel.';

  it('returns a valid overview made of the first sentences and the most frequent words', () => {
    const overview = SourceOverviewSchema.parse(JSON.parse(fakeOverview(message)));

    expect(overview.summary).toBe(
      'Dr. Brandt leitet das Projekt Nordlicht. Das Projekt untersucht Polarlicht.'
    );
    expect(overview.keyTopics).toContain('Projekt');
    expect(overview.suggestedQuestions[0]).toContain('nordlicht.txt');
  });

  it('copes with a document that has no text', () => {
    const overview = SourceOverviewSchema.parse(
      JSON.parse(fakeOverview('Document title: leer.txt\n\n'))
    );

    expect(overview.summary.length).toBeGreaterThan(0);
  });
});

describe('fakeStudio', () => {
  const chunks = [
    { id: 'id-1', text: 'Dr. Brandt leitet das Projekt. Es startete 2024.' },
    { id: 'id-2', text: 'Das Budget beträgt 1,25 Mio. Euro.' },
  ];
  const kinds = [
    [{ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.BRIEFING }, ReportSchema],
    [
      {
        kind: STUDIO_KIND.FLASHCARDS,
        size: STUDIO_SIZE.DEFAULT,
        difficulty: STUDIO_DIFFICULTY.MEDIUM,
      },
      FlashcardsReplySchema,
    ],
    [
      { kind: STUDIO_KIND.QUIZ, size: STUDIO_SIZE.DEFAULT, difficulty: STUDIO_DIFFICULTY.MEDIUM },
      QuizReplySchema,
    ],
    [{ kind: STUDIO_KIND.MINDMAP }, MindmapSchema],
  ] as const;

  it.each(kinds)(
    'makes %j in the shape the real model must deliver, citing the labels',
    (body, schema) => {
      const request = studioRequest(body, chunks, CHAT_LANGUAGE.AUTO);

      const made = schema.parse(JSON.parse(fakeStudio(request.schema, request.user)));

      expect(JSON.stringify(made)).toContain('c1');
      expect(JSON.stringify(made)).toContain('Dr. Brandt leitet das Projekt.');
    }
  );
});
