import { API_ERROR, ApiErrorSchema } from '@nlm/shared';
import { Hono } from 'hono';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from '../db/testing/test-db';
import { createAuth } from './auth';
import { type AuthVariables, requireUser } from './session';

const { db, pool } = createTestDb();
const BASE_URL = 'http://localhost:3000';
const auth = createAuth(db, {
  secret: 'a-test-secret-with-at-least-32-characters',
  baseURL: BASE_URL,
});

const EMAIL = 'nutzer@example.test';
const PASSWORD = 'ein-sicheres-passwort';

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: BASE_URL,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

/** The cookie header a browser would send back after a response that set cookies. */
function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('email and password auth', () => {
  it('signs a user up and signs them in with the same credentials', async () => {
    const signUp = await post('/sign-up/email', {
      name: 'Nutzer',
      email: EMAIL,
      password: PASSWORD,
    });
    expect(signUp.status).toBe(200);

    const signIn = await post('/sign-in/email', { email: EMAIL, password: PASSWORD });

    expect(signIn.status).toBe(200);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieOf(signIn) }),
    });
    expect(session?.user.email).toBe(EMAIL);
  });

  it('rejects a wrong password', async () => {
    await post('/sign-up/email', { name: 'Nutzer', email: EMAIL, password: PASSWORD });

    const response = await post('/sign-in/email', { email: EMAIL, password: 'falsches-passwort' });

    expect(response.status).toBe(401);
  });

  it('rejects a password that is too short', async () => {
    const response = await post('/sign-up/email', {
      name: 'Nutzer',
      email: EMAIL,
      password: 'kurz',
    });

    expect(response.status).toBe(400);
  });

  it('has no session without a cookie', async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it('never stores the password in clear text', async () => {
    await post('/sign-up/email', { name: 'Nutzer', email: EMAIL, password: PASSWORD });

    const rows = await pool.query('SELECT password FROM account');

    expect(rows.rows[0].password).not.toContain(PASSWORD);
    expect(String(rows.rows[0].password).length).toBeGreaterThan(40);
  });
});

describe('requireUser', () => {
  const app = new Hono<{ Variables: AuthVariables }>().get('/me', requireUser(auth), (c) =>
    c.json({ userId: c.get('userId') })
  );

  it('answers 401 with the shared error shape when nobody is signed in', async () => {
    const response = await app.request('/me');

    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json())).toEqual({
      code: API_ERROR.UNAUTHENTICATED,
    });
  });

  it('puts the user ID of the session into the request context', async () => {
    const signUp = await post('/sign-up/email', {
      name: 'Nutzer',
      email: EMAIL,
      password: PASSWORD,
    });
    const cookie = cookieOf(signUp);

    const response = await app.request('/me', { headers: { cookie } });

    expect(response.status).toBe(200);
    const [row] = (await pool.query('SELECT id FROM "user" WHERE email = $1', [EMAIL])).rows;
    expect(await response.json()).toEqual({ userId: row.id });
  });

  it('ignores a user ID sent by the client', async () => {
    const response = await app.request('/me', { headers: { 'x-user-id': 'someone-else' } });

    expect(response.status).toBe(401);
  });
});
