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
    expect(CHAT_SYSTEM_PROMPT).toMatch(/\*\*bold\*\*/);
  });

  it('asks for up to three follow-up questions, kept apart from the cited statements', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/follow-up questions/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/followUps/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/at most three/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/answerable from the context/i);
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

  it.each([
    [CHAT_LENGTH.SHORTER, /at most three statements/],
    [CHAT_LENGTH.LONGER, /up to ten statements/],
  ])('asks for the %s length with its own note after the plain prompt', (length, note) => {
    const prompt = chatSystemPrompt({ ...DEFAULT_CHAT_CONFIG, length });

    expect(prompt).toMatch(note);
    expect(prompt.startsWith(`${CHAT_SYSTEM_PROMPT} `)).toBe(true);
  });

  it.each([
    [CHAT_LANGUAGE.DE, /German/],
    [CHAT_LANGUAGE.EN, /English/],
  ])('asks for the %s language with its own note', (language, note) => {
    const prompt = chatSystemPrompt({ ...DEFAULT_CHAT_CONFIG, language });

    expect(prompt).toMatch(note);
    expect(prompt.match(/Always answer in/g)).toHaveLength(1);
  });

  it('puts the style first, then the length, then the language', () => {
    const prompt = chatSystemPrompt({
      style: CHAT_STYLE.LEARNING_GUIDE,
      customInstruction: '',
      length: CHAT_LENGTH.LONGER,
      language: CHAT_LANGUAGE.DE,
    });

    expect(prompt.indexOf('learning guide')).toBeLessThan(prompt.indexOf('up to ten'));
    expect(prompt.indexOf('up to ten')).toBeLessThan(prompt.indexOf('German'));
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
