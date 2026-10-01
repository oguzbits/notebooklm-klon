import {
  CHAT_ROLE,
  type ChatMessage,
  type ChunkDetail,
  type Note,
  SOURCE_KIND,
  SOURCE_STATUS,
  type SourceOverview,
  type SourceSummary,
  STUDIO_KIND,
  type StudioOutput,
  type StudioRequest,
} from '@nlm/shared';

export const NOTEBOOK_ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
export const SOURCE_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
export const CHUNK_ID = '5d1e8c2a-7b34-4f6d-9c05-2a8e6b1f3c47';
export const OTHER_CHUNK_ID = '6e2f9d3b-8c45-4a7e-8d16-3b9f7c2a4d58';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

export const notebook = (
  overrides: Partial<{ id: string; title: string; sourceCount: number }> = {}
) => ({
  id: NOTEBOOK_ID,
  title: 'Steuerrecht',
  sourceCount: 2,
  createdAt: CREATED_AT,
  ...overrides,
});

export const source = (overrides: Partial<SourceSummary> = {}): SourceSummary => ({
  id: SOURCE_ID,
  title: 'projekt.pdf',
  kind: SOURCE_KIND.PDF,
  status: SOURCE_STATUS.READY,
  failure: null,
  pageCount: 12,
  selected: true,
  createdAt: CREATED_AT,
  ...overrides,
});

export const chunkDetail = (overrides: Partial<ChunkDetail> = {}): ChunkDetail => ({
  id: CHUNK_ID,
  sourceId: SOURCE_ID,
  sourceTitle: 'projekt.pdf',
  sourceKind: SOURCE_KIND.PDF,
  text: 'Dr. Brandt leitet das Projekt Nordlicht.',
  startOffset: 8,
  endOffset: 48,
  ...overrides,
});

export const question = (text: string): ChatMessage => ({
  id: '11111111-1111-4111-8111-111111111111',
  role: CHAT_ROLE.USER,
  text,
  createdAt: CREATED_AT,
});

export const answer = (
  statements: { text: string; chunkIds: string[] }[],
  followUps: string[] = []
): ChatMessage => ({
  id: '22222222-2222-4222-8222-222222222222',
  role: CHAT_ROLE.ASSISTANT,
  statements,
  followUps,
  createdAt: CREATED_AT,
});

export const overview = (overrides: Partial<SourceOverview> = {}): SourceOverview => ({
  summary: 'Das Projekt Nordlicht erforscht Polarlicht über Norwegen.',
  keyTopics: ['Polarlicht', 'Budget'],
  suggestedQuestions: ['Wer leitet das Projekt?', 'Wie hoch ist das Budget?'],
  ...overrides,
});

export const NOTE_ID = '4c2d7e9f-2a58-4b1c-9d34-6e8f0a1b2c33';
export const ANSWER_ID = '22222222-2222-4222-8222-222222222222';

export const note = (overrides: Partial<Note> = {}): Note => ({
  id: NOTE_ID,
  messageId: ANSWER_ID,
  statements: [{ text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] }],
  createdAt: CREATED_AT,
  ...overrides,
});

export const OUTPUT_ID = '5e3d8f0a-3b69-4c2d-8e45-7f9a1b2c3d44';

/** What every output carries besides its content: how it was asked for, read or not, rated or not. */
const OUTPUT_META: { request: StudioRequest; unread: boolean; feedback: null } = {
  request: {
    prompt: 'Erstelle Karteikarten zu den Quellen.',
    sources: [{ id: SOURCE_ID, title: 'projekt.pdf' }],
  },
  unread: false,
  feedback: null,
};

export const flashcardsOutput = (): StudioOutput => ({
  id: OUTPUT_ID,
  kind: STUDIO_KIND.FLASHCARDS,
  title: 'Karteikarten',
  createdAt: CREATED_AT,
  ...OUTPUT_META,
  content: {
    cards: [
      { front: 'Wer leitet das Projekt?', back: 'Dr. Brandt', chunkIds: [CHUNK_ID] },
      { front: 'Wie hoch ist das Budget?', back: '1,25 Mio. Euro', chunkIds: [CHUNK_ID] },
    ],
  },
});

export const quizOutput = (): StudioOutput => ({
  id: OUTPUT_ID,
  kind: STUDIO_KIND.QUIZ,
  title: 'Quiz',
  createdAt: CREATED_AT,
  ...OUTPUT_META,
  content: {
    questions: [
      {
        question: 'Wer leitet das Projekt?',
        options: ['Dr. Brandt', 'Frau Weiß', 'Herr Kaya', 'Frau Lund'],
        correctIndex: 0,
        explanation: 'Dr. Brandt leitet das Projekt Nordlicht.',
        chunkIds: [CHUNK_ID],
      },
    ],
  },
});

export const mindmapOutput = (): StudioOutput => ({
  id: OUTPUT_ID,
  kind: STUDIO_KIND.MINDMAP,
  title: 'Nordlicht',
  createdAt: CREATED_AT,
  ...OUTPUT_META,
  content: {
    title: 'Nordlicht',
    branches: [
      {
        label: 'Leitung',
        chunkIds: [CHUNK_ID],
        children: [{ label: 'Dr. Brandt', chunkIds: [CHUNK_ID], children: [] }],
      },
    ],
  },
});
