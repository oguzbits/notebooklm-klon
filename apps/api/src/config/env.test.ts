import { describe, expect, it } from 'vitest';

import { parseDatabaseEnv, parseEnv, parseTestDatabaseEnv } from './env';

const SECRET = 'test-secret-value-1234';
const DB_PASSWORD = 'db-password-5678';
const DATABASE_URL = `postgresql://user:${DB_PASSWORD}@localhost:5432/app`;
const VALID = { GEMINI_API_KEY: SECRET, AI_MODEL: 'test-model', DATABASE_URL };

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : '';
  }
  return '';
}

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
    expect(() => parseEnv({})).toThrow(/DATABASE_URL[\s\S]*GEMINI_API_KEY[\s\S]*AI_MODEL/);
  });

  it('rejects blank values, as copied from an empty .env.example', () => {
    expect(() => parseEnv({ ...VALID, GEMINI_API_KEY: '', AI_MODEL: '  ' })).toThrow(
      /GEMINI_API_KEY/
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...VALID, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ ...VALID, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a DATABASE_URL that is not a postgres URL', () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(
      /DATABASE_URL/
    );
  });

  it('never puts secret values into the error message', () => {
    const message = messageOf(() =>
      parseEnv({ ...VALID, PORT: 'abc', DATABASE_URL: `mysql://user:${DB_PASSWORD}@localhost/db` })
    );

    expect(message).toContain('PORT');
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain(DB_PASSWORD);
  });
});

describe('parseDatabaseEnv', () => {
  it('needs only DATABASE_URL', () => {
    expect(parseDatabaseEnv({ DATABASE_URL })).toEqual({ DATABASE_URL });
  });

  it('fails without DATABASE_URL', () => {
    expect(() => parseDatabaseEnv({})).toThrow(/DATABASE_URL/);
  });
});

describe('parseTestDatabaseEnv', () => {
  it('defaults to the local docker database', () => {
    expect(parseTestDatabaseEnv({}).TEST_DATABASE_URL).toMatch(/localhost:54329\/nlm_test$/);
  });

  it('refuses a database whose name does not end with _test, so it is never reset by accident', () => {
    const production = `postgresql://user:${DB_PASSWORD}@host.example/neondb`;
    const message = messageOf(() => parseTestDatabaseEnv({ TEST_DATABASE_URL: production }));

    expect(message).toMatch(/TEST_DATABASE_URL.*_test/);
    expect(message).not.toContain(DB_PASSWORD);
  });
});
