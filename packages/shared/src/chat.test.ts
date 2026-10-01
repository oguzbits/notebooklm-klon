import { describe, expect, it } from 'vitest';

import { API_ERROR } from './api-error';
import {
  CHAT_EVENT,
  ChatEventSchema,
  ChatReplySchema,
  ChatRequestSchema,
  MAX_FOLLOW_UPS,
} from './chat';

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
      sourcesSearched: 2,
      passagesFound: 6,
      droppedStatements: 1,
      strippedCitations: 0,
      followUps: ['Wie geht es weiter?'],
    };

    expect(ChatEventSchema.parse(event)).toEqual(event);
  });

  it('limits the questions that follow an answer', () => {
    const closing = {
      type: CHAT_EVENT.DONE,
      statements: 1,
      sourcesSearched: 1,
      passagesFound: 3,
      droppedStatements: 0,
      strippedCitations: 0,
    };
    const questions = Array.from({ length: MAX_FOLLOW_UPS + 1 }, (_, i) => `Frage ${i}?`);

    expect(ChatEventSchema.safeParse({ ...closing, followUps: questions }).success).toBe(false);
    expect(ChatEventSchema.safeParse({ ...closing, followUps: [''] }).success).toBe(false);
    // The closing event always says what follows, even when nothing does.
    expect(ChatEventSchema.safeParse(closing).success).toBe(false);
    expect(ChatEventSchema.safeParse({ ...closing, followUps: [] }).success).toBe(true);
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

  it('reads what the model returns: the statements and up to three questions to ask next', () => {
    const reply = {
      statements: [{ text: 'Aussage.', chunkIds: ['c1'] }],
      followUps: ['  Und dann?  '],
    };

    expect(ChatReplySchema.parse(reply).followUps).toEqual(['Und dann?']);
    expect(ChatReplySchema.safeParse({ statements: [] }).success).toBe(false);
    expect(ChatReplySchema.safeParse({ ...reply, followUps: ['a', 'b', 'c', 'd'] }).success).toBe(
      false
    );
  });
});
