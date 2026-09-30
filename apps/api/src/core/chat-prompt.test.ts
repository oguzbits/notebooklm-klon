import { describe, expect, it } from 'vitest';

import { buildChatContext } from './chat-context';
import { ANSWER_JSON_SCHEMA, buildUserMessage, CHAT_SYSTEM_PROMPT } from './chat-prompt';

describe('chat prompt', () => {
  it('puts the numbered passages first and the question last', () => {
    const context = buildChatContext([
      { id: 'a', text: 'Erster Abschnitt.' },
      { id: 'b', text: 'Zweiter Abschnitt.' },
    ]);

    expect(buildUserMessage(context, 'Wer leitet es?')).toBe(
      '[c1]\nErster Abschnitt.\n\n[c2]\nZweiter Abschnitt.\n\nQuestion: Wer leitet es?'
    );
  });

  it('builds a message with no passages when nothing was found', () => {
    expect(buildUserMessage(buildChatContext([]), 'Frage?')).toBe('Question: Frage?');
  });

  it('tells the model to use only the passages, to cite them and to say so when they do not answer', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/only the numbered context passages/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/cite/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/does not contain the answer/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/language of the question/i);
  });

  it('asks for a number only when a passage states it literally', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/literally/i);
  });

  it('describes the answer as statements with text and chunk IDs, derived from the shared schema', () => {
    expect(ANSWER_JSON_SCHEMA).toMatchObject({
      type: 'object',
      required: ['statements'],
      properties: {
        statements: {
          type: 'array',
          items: {
            type: 'object',
            required: ['text', 'chunkIds'],
            properties: { text: { type: 'string' }, chunkIds: { type: 'array' } },
          },
        },
      },
    });
    expect(ANSWER_JSON_SCHEMA).not.toHaveProperty('$schema');
  });
});
