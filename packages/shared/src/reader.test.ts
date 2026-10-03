import { describe, expect, it } from 'vitest';

import { CHAT_ROLE, ChatMessageListSchema, ChatMessageSchema } from './reader';

const ID = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const OTHER_ID = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
const CREATED_AT = '2026-09-30T12:00:00.000Z';

describe('reader contract', () => {
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
    expect(ChatMessageSchema.parse(answer)).toEqual({ ...answer, followUps: [], trace: null });
    expect(ChatMessageListSchema.parse([question, answer])).toHaveLength(2);
  });

  it('keeps how an answer came about, and gives an older answer none', () => {
    const answer = {
      id: OTHER_ID,
      role: CHAT_ROLE.ASSISTANT,
      statements: [{ text: 'Dr. Brandt.', chunkIds: [ID] }],
      createdAt: CREATED_AT,
    };
    const trace = {
      sourcesSearched: 2,
      passagesFound: 5,
      droppedStatements: 1,
      strippedCitations: 0,
    };

    expect(ChatMessageSchema.parse({ ...answer, trace })).toMatchObject({ trace });
    expect(ChatMessageSchema.parse(answer)).toMatchObject({ trace: null });
    expect(ChatMessageSchema.safeParse({ ...answer, trace: { sourcesSearched: -1 } }).success).toBe(
      false
    );
  });

  it('keeps the questions an answer suggested, and gives an older answer none', () => {
    const answer = {
      id: OTHER_ID,
      role: CHAT_ROLE.ASSISTANT,
      statements: [{ text: 'Dr. Brandt.', chunkIds: [ID] }],
      createdAt: CREATED_AT,
    };

    expect(
      ChatMessageSchema.parse({ ...answer, followUps: ['Wie lange läuft es?'] })
    ).toMatchObject({ followUps: ['Wie lange läuft es?'] });
    expect(ChatMessageSchema.parse(answer)).toMatchObject({ followUps: [] });
    expect(
      ChatMessageSchema.safeParse({ ...answer, followUps: ['a', 'b', 'c', 'd'] }).success
    ).toBe(false);
  });

  it('rejects an assistant message without statements and a user message without text', () => {
    const base = { id: ID, createdAt: CREATED_AT };

    expect(ChatMessageSchema.safeParse({ ...base, role: CHAT_ROLE.ASSISTANT }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ ...base, role: CHAT_ROLE.USER }).success).toBe(false);
    expect(ChatMessageSchema.safeParse({ ...base, role: 'SYSTEM', text: 'x' }).success).toBe(false);
  });
});
