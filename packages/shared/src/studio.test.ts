import { describe, expect, it } from 'vitest';

import {
  CreateStudioBodySchema,
  REPORT_FORMAT,
  STUDIO_KIND,
  StudioOutputListSchema,
  StudioOutputSchema,
} from './studio';

const ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const CHUNK = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
const base = { id: ID, title: 'Titel', createdAt: '2026-09-30T12:00:00.000Z' };

const report = {
  ...base,
  kind: STUDIO_KIND.REPORT,
  format: REPORT_FORMAT.BRIEFING,
  content: {
    title: 'Briefing',
    sections: [{ heading: 'Lage', statements: [{ text: 'Es läuft.', chunkIds: [CHUNK] }] }],
  },
};
const quiz = {
  ...base,
  kind: STUDIO_KIND.QUIZ,
  content: {
    questions: [
      {
        question: 'Wer leitet es?',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        explanation: 'B leitet es.',
        chunkIds: [CHUNK],
      },
    ],
  },
};

describe('studio output contract', () => {
  it('parses every kind of output with its own content', () => {
    const flashcards = {
      ...base,
      kind: STUDIO_KIND.FLASHCARDS,
      content: { cards: [{ front: 'Frage', back: 'Antwort', chunkIds: [CHUNK] }] },
    };
    const mindmap = {
      ...base,
      kind: STUDIO_KIND.MINDMAP,
      content: {
        title: 'Thema',
        branches: [
          {
            label: 'Ast',
            chunkIds: [CHUNK],
            children: [
              {
                label: 'Zweig',
                chunkIds: [CHUNK],
                children: [{ label: 'Blatt', chunkIds: [CHUNK] }],
              },
            ],
          },
        ],
      },
    };

    const list = StudioOutputListSchema.parse([report, flashcards, quiz, mindmap]);

    expect(list.map((output) => output.kind)).toEqual(Object.values(STUDIO_KIND));
  });

  it('keeps the format only on a report and rejects content of another kind', () => {
    expect(StudioOutputSchema.safeParse({ ...report, format: 'NOPE' }).success).toBe(false);
    expect(StudioOutputSchema.safeParse({ ...report, kind: STUDIO_KIND.QUIZ }).success).toBe(false);
  });

  it('needs exactly four options and a correct answer among them', () => {
    const question = quiz.content.questions[0];
    const withQuestion = (changes: object) => ({
      ...quiz,
      content: { questions: [{ ...question, ...changes }] },
    });

    expect(StudioOutputSchema.safeParse(withQuestion({ options: ['A', 'B'] })).success).toBe(false);
    expect(StudioOutputSchema.safeParse(withQuestion({ correctIndex: 4 })).success).toBe(false);
  });

  it('asks for a format only when a report is requested', () => {
    expect(
      CreateStudioBodySchema.parse({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ })
    ).toEqual({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ });
    expect(CreateStudioBodySchema.parse({ kind: STUDIO_KIND.QUIZ })).toEqual({
      kind: STUDIO_KIND.QUIZ,
    });
    expect(CreateStudioBodySchema.safeParse({ kind: STUDIO_KIND.REPORT }).success).toBe(false);
  });
});
