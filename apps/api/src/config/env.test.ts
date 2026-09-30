import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const SECRET = 'test-secret-value-1234';
const VALID = { GEMINI_API_KEY: SECRET, AI_MODEL: 'test-model' };

describe('parseEnv', () => {
  it('applies defaults for NODE_ENV and PORT', () => {
    expect(parseEnv(VALID)).toEqual({
      ...VALID,
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ ...VALID, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every missing required variable', () => {
    expect(() => parseEnv({})).toThrow(/GEMINI_API_KEY[\s\S]*AI_MODEL/);
  });

  it('rejects blank values, as copied from an empty .env.example', () => {
    expect(() => parseEnv({ GEMINI_API_KEY: '', AI_MODEL: '  ' })).toThrow(/GEMINI_API_KEY/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...VALID, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ ...VALID, PORT: '70000' })).toThrow(/PORT/);
  });

  it('never puts secret values into the error message', () => {
    let message = '';
    try {
      parseEnv({ ...VALID, PORT: 'abc' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('PORT');
    expect(message).not.toContain(SECRET);
  });
});
