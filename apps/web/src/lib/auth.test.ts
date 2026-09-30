import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { AUTH_FAILURE, AuthError, getSession, signIn, signOut, signUp } from './auth';

const USER = { id: 'u1', name: 'Anna', email: 'anna@example.test' };

describe('getSession', () => {
  it('returns the signed-in user', async () => {
    server.use(
      http.get('*/api/auth/get-session', () => HttpResponse.json({ user: USER, session: {} }))
    );

    expect(await getSession()).toEqual(USER);
  });

  it('returns null when nobody is signed in', async () => {
    server.use(http.get('*/api/auth/get-session', () => HttpResponse.json(null)));

    expect(await getSession()).toBeNull();
  });

  it('throws when the server fails instead of pretending nobody is signed in', async () => {
    server.use(http.get('*/api/auth/get-session', () => new HttpResponse(null, { status: 500 })));

    await expect(getSession()).rejects.toBeInstanceOf(AuthError);
  });
});

describe('signIn and signUp', () => {
  it('sends the credentials as JSON', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/auth/sign-in/email', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: USER });
      })
    );

    await signIn('anna@example.test', 'geheim123');

    expect(body).toEqual({ email: 'anna@example.test', password: 'geheim123' });
  });

  it('names the account after the email address when signing up', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/auth/sign-up/email', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ user: USER });
      })
    );

    await signUp('anna@example.test', 'geheim123');

    expect(body).toEqual({
      name: 'anna@example.test',
      email: 'anna@example.test',
      password: 'geheim123',
    });
  });

  it('reports wrong credentials', async () => {
    server.use(
      http.post('*/api/auth/sign-in/email', () =>
        HttpResponse.json({ code: 'INVALID_EMAIL_OR_PASSWORD' }, { status: 401 })
      )
    );

    await expect(signIn('a@example.test', 'falsch')).rejects.toMatchObject({
      failure: AUTH_FAILURE.INVALID_CREDENTIALS,
    });
  });

  it('reports an email address that is already taken', async () => {
    server.use(
      http.post('*/api/auth/sign-up/email', () =>
        HttpResponse.json({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }, { status: 422 })
      )
    );

    await expect(signUp('a@example.test', 'geheim123')).rejects.toMatchObject({
      failure: AUTH_FAILURE.EMAIL_TAKEN,
    });
  });

  it('reports a password that is too short and any other failure as unknown', async () => {
    server.use(
      http.post('*/api/auth/sign-up/email', () =>
        HttpResponse.json({ code: 'PASSWORD_TOO_SHORT' }, { status: 400 })
      )
    );
    await expect(signUp('a@example.test', 'kurz')).rejects.toMatchObject({
      failure: AUTH_FAILURE.WEAK_PASSWORD,
    });

    server.use(
      http.post('*/api/auth/sign-up/email', () => new HttpResponse(null, { status: 500 }))
    );
    await expect(signUp('a@example.test', 'geheim123')).rejects.toMatchObject({
      failure: AUTH_FAILURE.UNKNOWN,
    });
  });
});

describe('signOut', () => {
  it('posts to the sign-out endpoint', async () => {
    let called = false;
    server.use(
      http.post('*/api/auth/sign-out', () => {
        called = true;
        return HttpResponse.json({ success: true });
      })
    );

    await signOut();

    expect(called).toBe(true);
  });
});
