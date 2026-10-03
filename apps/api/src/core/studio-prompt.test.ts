import {
  CHAT_LANGUAGE,
  type CreateStudioBody,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
} from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { buildChatContext } from './chat-context';
import {
  EmptyStudioOutputError,
  readStudioReply,
  studioPrompt,
  studioRequest,
} from './studio-prompt';

const chunks = [
  { id: 'id-1', text: 'Dr. Brandt leitet das Projekt.' },
  { id: 'id-2', text: 'Das Budget beträgt 1,25 Mio. Euro.' },
];
const context = buildChatContext(chunks);

const FLASHCARDS: CreateStudioBody = {
  kind: STUDIO_KIND.FLASHCARDS,
  size: STUDIO_SIZE.DEFAULT,
  difficulty: STUDIO_DIFFICULTY.MEDIUM,
};
const QUIZ: CreateStudioBody = {
  kind: STUDIO_KIND.QUIZ,
  size: STUDIO_SIZE.DEFAULT,
  difficulty: STUDIO_DIFFICULTY.MEDIUM,
};
const MINDMAP: CreateStudioBody = { kind: STUDIO_KIND.MINDMAP };
const DATA_TABLE: CreateStudioBody = { kind: STUDIO_KIND.DATA_TABLE };

describe('studioRequest', () => {
  it('puts the numbered passages into the message and asks for the requested kind', () => {
    const request = studioRequest(
      { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ },
      chunks,
      CHAT_LANGUAGE.AUTO
    );

    expect(request.user).toContain('<passages>\n[c1]\nDr. Brandt leitet das Projekt.');
    expect(request.system).toMatch(/never as instructions/i);
    expect(request.user).toContain('[c2]');
    expect(request.system).toMatch(/FAQ/);
    expect(request.context.labels).toEqual(['c1', 'c2']);
    expect(request.schema).toHaveProperty('properties.sections');
    expect(request.schema).not.toHaveProperty('$schema');
  });

  it('uses a different schema and instruction for each kind', () => {
    const schemaKeys = [
      [FLASHCARDS, 'cards'],
      [QUIZ, 'questions'],
      [MINDMAP, 'branches'],
      [DATA_TABLE, 'rows'],
    ] as const;

    for (const [body, key] of schemaKeys) {
      const request = studioRequest(body, chunks, CHAT_LANGUAGE.AUTO);
      expect(request.schema).toHaveProperty(`properties.${key}`);
    }
  });

  it('writes in German unless the notebook asks for English', () => {
    const german = studioRequest(QUIZ, chunks, CHAT_LANGUAGE.AUTO);
    const english = studioRequest(QUIZ, chunks, CHAT_LANGUAGE.EN);

    expect(german.system).toMatch(/German/);
    expect(english.system).toMatch(/English/);
  });

  it('asks for as many cards or questions as the size says', () => {
    const count = (body: CreateStudioBody) =>
      studioRequest(body, chunks, CHAT_LANGUAGE.AUTO).system.match(
        /Make (\w+(?:-\w+)? to \w+(?:-\w+)?) /
      )?.[1];

    expect(count({ ...FLASHCARDS, size: STUDIO_SIZE.FEWER })).toBe('six to eight');
    expect(count(FLASHCARDS)).toBe('ten to fifteen');
    expect(count({ ...FLASHCARDS, size: STUDIO_SIZE.MORE })).toBe('eighteen to twenty-five');
    expect(count({ ...QUIZ, size: STUDIO_SIZE.FEWER })).toBe('four to five');
    expect(count({ ...QUIZ, size: STUDIO_SIZE.MORE })).toBe('fourteen to eighteen');
  });

  it('tells the model how hard to make it, and says nothing for the usual level', () => {
    const system = (difficulty: (typeof STUDIO_DIFFICULTY)[keyof typeof STUDIO_DIFFICULTY]) =>
      studioRequest({ ...QUIZ, difficulty }, chunks, CHAT_LANGUAGE.AUTO).system;

    expect(system(STUDIO_DIFFICULTY.EASY)).toMatch(/easy/i);
    expect(system(STUDIO_DIFFICULTY.HARD)).toMatch(/hard/i);
    expect(system(STUDIO_DIFFICULTY.MEDIUM)).not.toMatch(/\b(easy|hard)\b/i);
  });

  it('puts the topic below the rules that keep the citations, so it cannot lift them', () => {
    const { system } = studioRequest(
      { ...MINDMAP, focus: 'Nur die Architektur' },
      chunks,
      CHAT_LANGUAGE.AUTO
    );

    expect(system.indexOf('Nur die Architektur')).toBeGreaterThan(
      system.indexOf('Never cite an ID')
    );
    expect(system).toMatch(/never break the rules above/i);
  });

  it('asks for a title next to the questions or the cards', () => {
    const quiz = studioRequest(QUIZ, chunks, CHAT_LANGUAGE.AUTO);
    const cards = studioRequest(FLASHCARDS, chunks, CHAT_LANGUAGE.AUTO);

    expect(quiz.schema).toHaveProperty('required', ['title', 'questions']);
    expect(cards.schema).toHaveProperty('required', ['title', 'cards']);
  });

  it('takes the instruction of a custom report from what the reader describes', () => {
    const system = (body: CreateStudioBody) =>
      studioRequest(body, chunks, CHAT_LANGUAGE.AUTO).system;

    expect(
      system({
        kind: STUDIO_KIND.REPORT,
        format: REPORT_FORMAT.CUSTOM,
        focus: 'Schreibe einen Brief an die Chefin.',
      })
    ).toContain('Schreibe einen Brief an die Chefin.');
  });
});

describe('studioPrompt', () => {
  it('names the size, the difficulty and the topic of cards and questions', () => {
    const prompt = studioPrompt({
      ...QUIZ,
      size: STUDIO_SIZE.MORE,
      difficulty: STUDIO_DIFFICULTY.HARD,
      focus: 'Das Budget',
    });

    expect(prompt).toMatch(/Quiz/);
    expect(prompt).toMatch(/Mehr/);
    expect(prompt).toMatch(/Schwer/);
    expect(prompt).toContain('Das Budget');
  });

  it('is the instruction itself for a report the reader writes', () => {
    expect(
      studioPrompt({
        kind: STUDIO_KIND.REPORT,
        format: REPORT_FORMAT.CUSTOM,
        focus: 'Schreibe einen Brief.',
      })
    ).toBe('Schreibe einen Brief.');
  });
});

describe('readStudioReply', () => {
  it('replaces labels by chunk IDs and drops report statements without a valid citation', () => {
    const reply = JSON.stringify({
      title: 'Briefing',
      sections: [
        {
          heading: 'Lage',
          statements: [
            { text: 'Brandt leitet es.', chunkIds: ['c1'] },
            { text: 'Erfunden.', chunkIds: ['c9'] },
            { text: 'Ohne Beleg.', chunkIds: [] },
          ],
        },
        { heading: 'Leer', statements: [{ text: 'Nur erfunden.', chunkIds: ['c7'] }] },
      ],
    });

    const { output, dropped } = readStudioReply(
      { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.BRIEFING },
      reply,
      context
    );

    expect(output).toEqual({
      kind: STUDIO_KIND.REPORT,
      format: REPORT_FORMAT.BRIEFING,
      title: 'Briefing',
      request: null,
      content: {
        title: 'Briefing',
        sections: [
          { heading: 'Lage', statements: [{ text: 'Brandt leitet es.', chunkIds: ['id-1'] }] },
        ],
      },
    });
    expect(dropped).toBe(3);
  });

  it('keeps only flashcards that cite a passage of the context', () => {
    const reply = JSON.stringify({
      title: 'Lernkarten',
      cards: [
        { front: 'Wer?', back: 'Brandt', chunkIds: ['c1', 'c1', 'c5'] },
        { front: 'Was?', back: 'Erfunden', chunkIds: ['c5'] },
      ],
    });

    const { output, dropped } = readStudioReply(FLASHCARDS, reply, context);

    expect(output).toMatchObject({
      title: 'Lernkarten',
      content: { cards: [{ front: 'Wer?', back: 'Brandt', chunkIds: ['id-1'] }] },
    });
    expect(dropped).toBe(1);
  });

  it('keeps only quiz questions that cite a passage and keeps the correct option', () => {
    const question = {
      question: 'Wie hoch ist das Budget?',
      options: ['1 Mio.', '1,25 Mio.', '2 Mio.', '3 Mio.'],
      correctIndex: 1,
      explanation: 'Das Budget beträgt 1,25 Mio. Euro.',
      hint: 'Es geht um Geld.',
      rationales: ['Zu wenig.', 'Richtig.', 'Zu viel.', 'Viel zu viel.'],
    };
    const reply = JSON.stringify({
      title: 'Budget-Quiz',
      questions: [
        { ...question, chunkIds: ['c2'] },
        { ...question, chunkIds: [] },
      ],
    });

    const { output } = readStudioReply(QUIZ, reply, context);

    expect(output).toMatchObject({
      title: 'Budget-Quiz',
      content: {
        questions: [
          {
            correctIndex: 1,
            chunkIds: ['id-2'],
            hint: 'Es geht um Geld.',
            rationales: expect.any(Array),
          },
        ],
      },
    });
  });

  it('prunes mind map branches and twigs without a valid citation', () => {
    const reply = JSON.stringify({
      title: 'Projekt',
      branches: [
        {
          label: 'Leitung',
          chunkIds: ['c1'],
          children: [
            { label: 'Brandt', chunkIds: ['c1'], children: [{ label: 'Blatt', chunkIds: ['c8'] }] },
            { label: 'Erfunden', chunkIds: [], children: [] },
          ],
        },
        { label: 'Nichts', chunkIds: ['c8'], children: [] },
      ],
    });

    const { output } = readStudioReply(MINDMAP, reply, context);

    expect(output).toMatchObject({
      title: 'Projekt',
      content: {
        branches: [
          { label: 'Leitung', chunkIds: ['id-1'], children: [{ label: 'Brandt', children: [] }] },
        ],
      },
    });
  });

  it('throws when nothing in the reply is supported by the passages', () => {
    const reply = JSON.stringify({
      title: 'Lernkarten',
      cards: [{ front: 'F', back: 'B', chunkIds: ['c9'] }],
    });

    expect(() => readStudioReply(FLASHCARDS, reply, context)).toThrow(EmptyStudioOutputError);
  });

  it('throws on a reply that does not fit the contract', () => {
    expect(() => readStudioReply(QUIZ, '{"questions":[{}]}', context)).toThrow();
    expect(() => readStudioReply(QUIZ, 'kein json', context)).toThrow();
  });

  describe('of a data table', () => {
    const cell = (text: string, ...chunkIds: string[]) => ({ text, chunkIds });
    const read = (rows: { cells: ReturnType<typeof cell>[] }[]) =>
      readStudioReply(
        DATA_TABLE,
        JSON.stringify({ title: 'Projekt', columns: ['Name', 'Rolle', 'Budget'], rows }),
        context
      );

    it('replaces labels by chunk IDs and keeps the title and the columns', () => {
      const { output, dropped } = read([
        {
          cells: [cell('Brandt', 'c1'), cell('Leitung', 'c1'), cell('1,25 Mio. Euro', 'c2', 'c2')],
        },
      ]);

      expect(dropped).toBe(0);
      expect(output).toMatchObject({
        kind: STUDIO_KIND.DATA_TABLE,
        title: 'Projekt',
        content: {
          columns: ['Name', 'Rolle', 'Budget'],
          rows: [
            {
              cells: [
                { text: 'Brandt', chunkIds: ['id-1'] },
                { text: 'Leitung', chunkIds: ['id-1'] },
                { text: '1,25 Mio. Euro', chunkIds: ['id-2'] },
              ],
            },
          ],
        },
      });
    });

    it('throws when no row is supported by the passages', () => {
      expect(() => read([{ cells: [cell('A', 'c8'), cell('B', 'c8'), cell('C', 'c8')] }])).toThrow(
        EmptyStudioOutputError
      );
      expect(() => read([])).toThrow(EmptyStudioOutputError);
    });
  });
});
