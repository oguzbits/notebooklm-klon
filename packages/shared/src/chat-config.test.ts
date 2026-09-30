import { describe, expect, it } from 'vitest';

import {
  CHAT_LANGUAGE,
  CHAT_LENGTH,
  CHAT_STYLE,
  ChatConfigSchema,
  DEFAULT_CHAT_CONFIG,
} from './chat-config';

describe('chat config contract', () => {
  it('has a default that changes nothing about the answers', () => {
    expect(ChatConfigSchema.parse(DEFAULT_CHAT_CONFIG)).toEqual({
      style: CHAT_STYLE.DEFAULT,
      customInstruction: '',
      length: CHAT_LENGTH.DEFAULT,
      language: CHAT_LANGUAGE.AUTO,
    });
  });

  it('needs an instruction for the custom style and caps its length', () => {
    const custom = { ...DEFAULT_CHAT_CONFIG, style: CHAT_STYLE.CUSTOM };

    expect(ChatConfigSchema.safeParse(custom).success).toBe(false);
    expect(
      ChatConfigSchema.safeParse({ ...custom, customInstruction: 'Antworte wie ein Pirat.' })
        .success
    ).toBe(true);
    expect(
      ChatConfigSchema.safeParse({ ...custom, customInstruction: 'x'.repeat(501) }).success
    ).toBe(false);
  });

  it('rejects values it does not know', () => {
    expect(ChatConfigSchema.safeParse({ ...DEFAULT_CHAT_CONFIG, length: 'HUGE' }).success).toBe(
      false
    );
  });
});
