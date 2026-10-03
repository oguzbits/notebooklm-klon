import { describe, expect, it } from 'vitest';

import { parseDatabaseEnv, parseEnv, parseTestDatabaseEnv } from './env';

const SECRET = 'test-secret-value-1234';
const DB_PASSWORD = 'db-password-5678';
const DATABASE_URL = `postgresql://user:${DB_PASSWORD}@localhost:5432/app`;
const VALID = {
  GEMINI_API_KEY: SECRET,
  AI_MODEL: 'test-chat-model',
  PARSE_MODEL: 'test-parse-model',
  EMBEDDING_MODEL: 'test-embedding-model',
  BETTER_AUTH_SECRET: 'a-test-secret-with-at-least-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DATABASE_URL,
};

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

  it('has no fallback parse model unless one is set, and rejects a blank value', () => {
    expect(parseEnv(VALID).PARSE_FALLBACK_MODEL).toBeUndefined();
    expect(parseEnv({ ...VALID, PARSE_FALLBACK_MODEL: 'test-fallback-model' })).toMatchObject({
      PARSE_FALLBACK_MODEL: 'test-fallback-model',
    });
    expect(() => parseEnv({ ...VALID, PARSE_FALLBACK_MODEL: ' ' })).toThrow(/PARSE_FALLBACK_MODEL/);
  });

  it('serves no web app unless WEB_DIST_DIR is set, and rejects a blank value', () => {
    expect(parseEnv(VALID).WEB_DIST_DIR).toBeUndefined();
    expect(parseEnv({ ...VALID, WEB_DIST_DIR: 'apps/web/dist' }).WEB_DIST_DIR).toBe(
      'apps/web/dist'
    );
    expect(() => parseEnv({ ...VALID, WEB_DIST_DIR: '  ' })).toThrow(/WEB_DIST_DIR/);
  });

  it('takes the demo account only as a valid email address and a password of 8 characters', () => {
    const demo = { SEED_DEMO_EMAIL: 'demo@example.test', SEED_DEMO_PASSWORD: 'demo-passwort' };

    expect(parseEnv({ ...VALID, ...demo })).toMatchObject(demo);
    expect(() => parseEnv({ ...VALID, ...demo, SEED_DEMO_EMAIL: 'keine-mail' })).toThrow(
      /SEED_DEMO_EMAIL/
    );
    expect(() => parseEnv({ ...VALID, ...demo, SEED_DEMO_PASSWORD: 'kurz' })).toThrow(
      /SEED_DEMO_PASSWORD/
    );
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ ...VALID, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every missing required variable', () => {
    expect(() => parseEnv({})).toThrow(
      /DATABASE_URL[\s\S]*GEMINI_API_KEY[\s\S]*AI_MODEL[\s\S]*PARSE_MODEL[\s\S]*EMBEDDING_MODEL[\s\S]*BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL/
    );
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
});

describe('parseTestDatabaseEnv', () => {
  it('defaults to the local docker database', () => {
    expect(parseTestDatabaseEnv({}).TEST_DATABASE_URL).toMatch(/localhost:54329\/nlm_test$/);
  });

  it('refuses a database whose name does not end with _test, so it is never reset by accident', () => {
    const production = `postgresql://user:${DB_PASSWORD}@host.example/nlm`;
    const message = messageOf(() => parseTestDatabaseEnv({ TEST_DATABASE_URL: production }));

    expect(message).toMatch(/TEST_DATABASE_URL.*_test/);
    expect(message).not.toContain(DB_PASSWORD);
  });
});
