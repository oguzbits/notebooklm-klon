import {
  CHAT_ROLE,
  type ChatMessage,
  type ChunkDetail,
  SOURCE_KIND,
  SOURCE_STATUS,
  type SourceSummary,
} from '@nlm/shared';

export const NOTEBOOK_ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
export const SOURCE_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
export const CHUNK_ID = '5d1e8c2a-7b34-4f6d-9c05-2a8e6b1f3c47';
export const OTHER_CHUNK_ID = '6e2f9d3b-8c45-4a7e-8d16-3b9f7c2a4d58';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

export const notebook = (overrides: Partial<{ id: string; title: string }> = {}) => ({
  id: NOTEBOOK_ID,
  title: 'Steuerrecht',
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

export const answer = (statements: { text: string; chunkIds: string[] }[]): ChatMessage => ({
  id: '22222222-2222-4222-8222-222222222222',
  role: CHAT_ROLE.ASSISTANT,
  statements,
  createdAt: CREATED_AT,
});
