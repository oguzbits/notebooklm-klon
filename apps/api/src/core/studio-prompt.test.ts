import { CHAT_LANGUAGE, REPORT_FORMAT, STUDIO_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { buildChatContext } from './chat-context';
import {
  EmptyStudioOutputError,
  readStudioReply,
  STUDIO_DEFAULT_TITLE,
  studioRequest,
} from './studio-prompt';

const chunks = [
  { id: 'id-1', text: 'Dr. Brandt leitet das Projekt.' },
  { id: 'id-2', text: 'Das Budget beträgt 1,25 Mio. Euro.' },
];
const context = buildChatContext(chunks);

describe('studioRequest', () => {
  it('puts the numbered passages into the message and asks for the requested kind', () => {
    const request = studioRequest(
      { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ },
      chunks,
      CHAT_LANGUAGE.AUTO
    );

    expect(request.user).toContain('[c1]\nDr. Brandt leitet das Projekt.');
    expect(request.user).toContain('[c2]');
    expect(request.system).toMatch(/FAQ/);
    expect(request.context.labels).toEqual(['c1', 'c2']);
    expect(request.schema).toHaveProperty('properties.sections');
    expect(request.schema).not.toHaveProperty('$schema');
  });

  it('uses a different schema and instruction for each kind', () => {
    const schemaKeys = [
      [{ kind: STUDIO_KIND.FLASHCARDS }, 'cards'],
      [{ kind: STUDIO_KIND.QUIZ }, 'questions'],
      [{ kind: STUDIO_KIND.MINDMAP }, 'branches'],
    ] as const;

    for (const [body, key] of schemaKeys) {
      const request = studioRequest(body, chunks, CHAT_LANGUAGE.AUTO);
      expect(request.schema).toHaveProperty(`properties.${key}`);
    }
  });

  it('writes in German unless the notebook asks for English', () => {
    const german = studioRequest({ kind: STUDIO_KIND.QUIZ }, chunks, CHAT_LANGUAGE.AUTO);
    const english = studioRequest({ kind: STUDIO_KIND.QUIZ }, chunks, CHAT_LANGUAGE.EN);

    expect(german.system).toMatch(/German/);
    expect(english.system).toMatch(/English/);
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
      cards: [
        { front: 'Wer?', back: 'Brandt', chunkIds: ['c1', 'c1', 'c5'] },
        { front: 'Was?', back: 'Erfunden', chunkIds: ['c5'] },
      ],
    });

    const { output, dropped } = readStudioReply({ kind: STUDIO_KIND.FLASHCARDS }, reply, context);

    expect(output).toMatchObject({
      title: STUDIO_DEFAULT_TITLE.FLASHCARDS,
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
    };
    const reply = JSON.stringify({
      questions: [
        { ...question, chunkIds: ['c2'] },
        { ...question, chunkIds: [] },
      ],
    });

    const { output } = readStudioReply({ kind: STUDIO_KIND.QUIZ }, reply, context);

    expect(output).toMatchObject({
      content: { questions: [{ correctIndex: 1, chunkIds: ['id-2'] }] },
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

    const { output } = readStudioReply({ kind: STUDIO_KIND.MINDMAP }, reply, context);

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
    const reply = JSON.stringify({ cards: [{ front: 'F', back: 'B', chunkIds: ['c9'] }] });

    expect(() => readStudioReply({ kind: STUDIO_KIND.FLASHCARDS }, reply, context)).toThrow(
      EmptyStudioOutputError
    );
  });

  it('throws on a reply that does not fit the contract', () => {
    expect(() =>
      readStudioReply({ kind: STUDIO_KIND.QUIZ }, '{"questions":[{}]}', context)
    ).toThrow();
    expect(() => readStudioReply({ kind: STUDIO_KIND.QUIZ }, 'kein json', context)).toThrow();
  });
});
