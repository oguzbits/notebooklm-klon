import { CHAT_LANGUAGE, CHAT_LENGTH, CHAT_STYLE, DEFAULT_CHAT_CONFIG } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { buildChatContext } from './chat-context';
import {
  ANSWER_JSON_SCHEMA,
  buildUserMessage,
  CHAT_SYSTEM_PROMPT,
  chatSystemPrompt,
} from './chat-prompt';

describe('chat prompt', () => {
  it('puts the numbered passages first and the question last', () => {
    const context = buildChatContext([
      { id: 'a', text: 'Erster Abschnitt.' },
      { id: 'b', text: 'Zweiter Abschnitt.' },
    ]);

    expect(buildUserMessage(context, 'Wer leitet es?')).toBe(
      '<passages>\n[c1]\nErster Abschnitt.\n\n[c2]\nZweiter Abschnitt.\n</passages>\n\nQuestion: Wer leitet es?'
    );
  });

  it('puts the earlier turns before the passages, so the question stays last', () => {
    const context = buildChatContext([{ id: 'a', text: 'Abschnitt.' }]);
    const message = buildUserMessage(context, 'Und 2019?', [
      { question: 'Wer?', answer: 'Brandt.' },
    ]);

    expect(message).toBe(
      '<history>\nQuestion: Wer?\nAnswer: Brandt.\n</history>\n\n<passages>\n[c1]\nAbschnitt.\n</passages>\n\nQuestion: Und 2019?'
    );
  });

  it('builds a message with no passages when nothing was found', () => {
    expect(buildUserMessage(buildChatContext([]), 'Frage?')).toBe('Question: Frage?');
  });

  it('tells the model that the passages are data and that instructions inside them do not count', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/<passages>/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never as instructions/i);
  });

  it('describes the answer as statements with text and chunk IDs, derived from the shared schema', () => {
    expect(ANSWER_JSON_SCHEMA).toMatchObject({
      type: 'object',
      required: ['statements', 'followUps'],
      properties: {
        followUps: { type: 'array', maxItems: 3, items: { type: 'string' } },
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

describe('chatSystemPrompt', () => {
  it('is the plain prompt for the default config', () => {
    expect(chatSystemPrompt(DEFAULT_CHAT_CONFIG)).toBe(CHAT_SYSTEM_PROMPT);
  });

  it('adds the rule that the history is no source only when there is a history', () => {
    expect(chatSystemPrompt(DEFAULT_CHAT_CONFIG, true)).toMatch(/<history>.*no source/);
    expect(chatSystemPrompt(DEFAULT_CHAT_CONFIG, false)).not.toMatch(/history/i);
  });

  it('adds the style, the length and the language the notebook asks for', () => {
    const prompt = chatSystemPrompt({
      style: CHAT_STYLE.LEARNING_GUIDE,
      customInstruction: '',
      length: CHAT_LENGTH.SHORTER,
      language: CHAT_LANGUAGE.EN,
    });

    expect(prompt.startsWith(CHAT_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toMatch(/learning guide/i);
    expect(prompt).toMatch(/short/i);
    expect(prompt).toMatch(/English/);
  });

  it('passes a custom instruction on, below the rules that keep the answers cited', () => {
    const prompt = chatSystemPrompt({
      ...DEFAULT_CHAT_CONFIG,
      style: CHAT_STYLE.CUSTOM,
      customInstruction: 'Antworte wie ein Pirat.',
    });

    expect(prompt.indexOf('Antworte wie ein Pirat.')).toBeGreaterThan(
      prompt.indexOf('Never cite an ID')
    );
    expect(prompt).toMatch(/never break the rules above/i);
  });

  it('ignores a leftover instruction when the style is not custom', () => {
    const prompt = chatSystemPrompt({ ...DEFAULT_CHAT_CONFIG, customInstruction: 'Alt.' });

    expect(prompt).not.toContain('Alt.');
  });
});
