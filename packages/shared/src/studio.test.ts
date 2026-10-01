import { describe, expect, it } from 'vitest';

import {
  CreateStudioBodySchema,
  FlashcardsReplySchema,
  MAX_STUDIO_FOCUS_CHARS,
  QuizReplySchema,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_FEEDBACK,
  STUDIO_KIND,
  STUDIO_SIZE,
  StudioOutputListSchema,
  StudioOutputSchema,
  StudioUpdateBodySchema,
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
    expect(CreateStudioBodySchema.safeParse({ kind: STUDIO_KIND.REPORT }).success).toBe(false);
  });

  it('gives flashcards and a quiz the default size and difficulty when none is asked for', () => {
    const expected = { size: STUDIO_SIZE.DEFAULT, difficulty: STUDIO_DIFFICULTY.MEDIUM };

    expect(CreateStudioBodySchema.parse({ kind: STUDIO_KIND.QUIZ })).toEqual({
      kind: STUDIO_KIND.QUIZ,
      ...expected,
    });
    expect(
      CreateStudioBodySchema.parse({
        kind: STUDIO_KIND.FLASHCARDS,
        size: STUDIO_SIZE.MORE,
        difficulty: STUDIO_DIFFICULTY.HARD,
      })
    ).toEqual({
      kind: STUDIO_KIND.FLASHCARDS,
      size: STUDIO_SIZE.MORE,
      difficulty: STUDIO_DIFFICULTY.HARD,
    });
    expect(CreateStudioBodySchema.parse({ kind: STUDIO_KIND.MINDMAP })).toEqual({
      kind: STUDIO_KIND.MINDMAP,
    });
    expect(CreateStudioBodySchema.safeParse({ kind: STUDIO_KIND.QUIZ, size: 'HUGE' }).success).toBe(
      false
    );
  });

  it('can name a topic and the sources to use, and refuses an empty or foreign-looking list', () => {
    const parsed = CreateStudioBodySchema.parse({
      kind: STUDIO_KIND.MINDMAP,
      focus: '  Nur die Architektur  ',
      sourceIds: [CHUNK],
    });

    expect(parsed).toEqual({
      kind: STUDIO_KIND.MINDMAP,
      focus: 'Nur die Architektur',
      sourceIds: [CHUNK],
    });
    expect(
      CreateStudioBodySchema.safeParse({ kind: STUDIO_KIND.MINDMAP, sourceIds: [] }).success
    ).toBe(false);
    expect(
      CreateStudioBodySchema.safeParse({ kind: STUDIO_KIND.MINDMAP, sourceIds: ['kein-uuid'] })
        .success
    ).toBe(false);
    expect(
      CreateStudioBodySchema.safeParse({
        kind: STUDIO_KIND.MINDMAP,
        focus: 'x'.repeat(MAX_STUDIO_FOCUS_CHARS + 1),
      }).success
    ).toBe(false);
  });

  it('needs the instruction itself when the reader writes the report', () => {
    const custom = { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.CUSTOM };

    expect(CreateStudioBodySchema.safeParse(custom).success).toBe(false);
    expect(CreateStudioBodySchema.safeParse({ ...custom, focus: '   ' }).success).toBe(false);
    expect(
      CreateStudioBodySchema.safeParse({ ...custom, focus: 'Schreibe einen Brief an die Chefin.' })
        .success
    ).toBe(true);
    expect(
      CreateStudioBodySchema.safeParse({ ...custom, format: REPORT_FORMAT.BLOG }).success
    ).toBe(true);
  });

  it('keeps how an output was asked for, whether it is still unread and what the reader thought of it', () => {
    const asked = {
      ...quiz,
      request: { prompt: 'Erstelle ein Quiz.', sources: [{ id: CHUNK, title: 'projekt.pdf' }] },
      unread: true,
      feedback: STUDIO_FEEDBACK.GOOD,
    };

    expect(StudioOutputSchema.parse(asked)).toMatchObject({
      request: { prompt: 'Erstelle ein Quiz.' },
      unread: true,
      feedback: STUDIO_FEEDBACK.GOOD,
    });
    // An output from before has none of it.
    expect(StudioOutputSchema.parse(quiz)).toMatchObject({
      request: null,
      unread: false,
      feedback: null,
    });
    expect(StudioOutputSchema.safeParse({ ...asked, feedback: 'OK' }).success).toBe(false);
  });

  it('lets a question carry a hint and a reason for every option, but needs all four', () => {
    const question = quiz.content.questions[0];
    const withQuestion = (changes: object) => ({
      ...quiz,
      content: { questions: [{ ...question, ...changes }] },
    });

    expect(
      StudioOutputSchema.safeParse(
        withQuestion({ hint: 'Denk an den Titel.', rationales: ['a', 'b', 'c', 'd'] })
      ).success
    ).toBe(true);
    expect(StudioOutputSchema.safeParse(withQuestion({ rationales: ['a', 'b'] })).success).toBe(
      false
    );
  });

  it('asks the model for a title, and for a quiz also a hint and a reason for every option', () => {
    expect(
      FlashcardsReplySchema.safeParse({ cards: [{ front: 'F', back: 'B', chunkIds: [] }] }).success
    ).toBe(false);
    expect(
      FlashcardsReplySchema.safeParse({
        title: 'Lernkarten',
        cards: [{ front: 'F', back: 'B', chunkIds: [] }],
      }).success
    ).toBe(true);

    const question = quiz.content.questions[0];
    expect(QuizReplySchema.safeParse({ title: 'Quiz', questions: [question] }).success).toBe(false);
    expect(
      QuizReplySchema.safeParse({
        title: 'Quiz',
        questions: [{ ...question, hint: 'Tipp', rationales: ['a', 'b', 'c', 'd'] }],
      }).success
    ).toBe(true);
  });

  it('updates a title, the feedback or the read mark, but not nothing', () => {
    expect(StudioUpdateBodySchema.parse({ title: '  Neuer Name  ' })).toEqual({
      title: 'Neuer Name',
    });
    expect(StudioUpdateBodySchema.parse({ feedback: null })).toEqual({ feedback: null });
    expect(StudioUpdateBodySchema.parse({ feedback: STUDIO_FEEDBACK.BAD })).toEqual({
      feedback: STUDIO_FEEDBACK.BAD,
    });
    expect(StudioUpdateBodySchema.parse({ read: true })).toEqual({ read: true });
    expect(StudioUpdateBodySchema.safeParse({}).success).toBe(false);
    expect(StudioUpdateBodySchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});
