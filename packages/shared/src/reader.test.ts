import { describe, expect, it } from 'vitest';

import {
  CHAT_ROLE,
  ChatMessageListSchema,
  ChatMessageSchema,
  ChunkDetailSchema,
  SourceTextSchema,
} from './reader';
import { SOURCE_KIND } from './source';

const ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const OTHER_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

describe('reader contract', () => {
  it('parses the details of a cited chunk', () => {
    const chunk = {
      id: ID,
      sourceId: OTHER_ID,
      sourceTitle: 'projekt.pdf',
      sourceKind: SOURCE_KIND.PDF,
      text: 'Dr. Brandt leitet das Projekt.',
      startOffset: 10,
      endOffset: 40,
    };

    expect(ChunkDetailSchema.parse(chunk)).toEqual(chunk);
  });

  it('rejects a chunk whose offsets are negative or not whole numbers', () => {
    const chunk = {
      id: ID,
      sourceId: OTHER_ID,
      sourceTitle: 'a',
      sourceKind: SOURCE_KIND.TXT,
      text: 'b',
      endOffset: 1,
    };

    expect(ChunkDetailSchema.safeParse({ ...chunk, startOffset: -1 }).success).toBe(false);
    expect(ChunkDetailSchema.safeParse({ ...chunk, startOffset: 0.5 }).success).toBe(false);
  });

  it('parses the text of a source, with or without a web address', () => {
    const source = { id: ID, title: 'Seite', kind: SOURCE_KIND.URL, text: 'Inhalt' };

    expect(
      SourceTextSchema.parse({ ...source, sourceUrl: 'https://example.test/a' }).sourceUrl
    ).toBe('https://example.test/a');
    expect(SourceTextSchema.parse({ ...source, sourceUrl: null }).sourceUrl).toBeNull();
  });

  it('parses a user message and an assistant message by their role', () => {
    const question = {
      id: ID,
      role: CHAT_ROLE.USER,
      text: 'Wer leitet es?',
      createdAt: CREATED_AT,
    };
    const answer = {
      id: OTHER_ID,
      role: CHAT_ROLE.ASSISTANT,
      statements: [{ text: 'Dr. Brandt.', chunkIds: [ID] }],
      createdAt: CREATED_AT,
    };

    expect(ChatMessageSchema.parse(question)).toEqual(question);
    expect(ChatMessageSchema.parse(answer)).toEqual(answer);
    expect(ChatMessageListSchema.parse([question, answer])).toHaveLength(2);
  });

  it('rejects an assistant message without statements and a user message without text', () => {
    const base = { id: ID, createdAt: CREATED_AT };

    expect(ChatMessageSchema.safeParse({ ...base, role: CHAT_ROLE.ASSISTANT }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ ...base, role: CHAT_ROLE.USER }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ ...base, role: 'SYSTEM', text: 'x' }).success).toBe(false);
  });
});
