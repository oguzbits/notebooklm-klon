import { describe, expect, it } from 'vitest';

import { API_ERROR } from './api-error';
import { CHAT_EVENT, ChatEventSchema, ChatRequestSchema } from './chat';

describe('chat contract', () => {
  it('trims the question and rejects an empty or very long one', () => {
    expect(ChatRequestSchema.parse({ question: '  Wer leitet das Projekt?  ' })).toEqual({
      question: 'Wer leitet das Projekt?',
    });
    expect(ChatRequestSchema.safeParse({ question: '   ' }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ question: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('parses a statement event with real chunk IDs', () => {
    const event = { type: CHAT_EVENT.STATEMENT, text: 'Aussage.', chunkIds: ['id-1'] };

    expect(ChatEventSchema.parse(event)).toEqual(event);
  });

  it('parses the closing event with its counts', () => {
    const event = {
      type: CHAT_EVENT.DONE,
      statements: 2,
      droppedStatements: 1,
      strippedCitations: 0,
    };

    expect(ChatEventSchema.parse(event)).toEqual(event);
  });

  it('parses an error event only with a known API error code', () => {
    expect(ChatEventSchema.parse({ type: CHAT_EVENT.ERROR, code: API_ERROR.INTERNAL }).type).toBe(
      CHAT_EVENT.ERROR
    );
    expect(ChatEventSchema.safeParse({ type: CHAT_EVENT.ERROR, code: 'BOOM' }).success).toBe(false);
  });

  it('rejects an unknown event type and a statement without citations', () => {
    expect(ChatEventSchema.safeParse({ type: 'PING' }).success).toBe(false);
    expect(
      ChatEventSchema.safeParse({ type: CHAT_EVENT.STATEMENT, text: 'x', chunkIds: [] }).success
    ).toBe(false);
  });
});
