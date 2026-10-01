import {
  API_ERROR,
  ApiErrorSchema,
  GuestStartSchema,
  NotebookListSchema,
  SourceListSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { DEMO_NOTEBOOK_TITLE } from './config/demo';
import { LIMITS } from './config/limits';
import { BASE_URL, createHarness, DEMO_OWNER_EMAIL } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const harness = createHarness();
const app = createApp(harness.deps);

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');

async function signUp(email: string): Promise<string> {
  const response = await harness.auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ name: email, email, password: PASSWORD }),
    })
  );
  return cookieOf(response);
}

const postJson = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** The example notebook of the demo owner, made the normal way: one ready source with passages. */
async function makeExample() {
  const owner = await signUp(DEMO_OWNER_EMAIL);
  const created = await app.request(
    '/api/notebooks',
    postJson(owner, { title: DEMO_NOTEBOOK_TITLE })
  );
  const { id } = (await created.json()) as { id: string };
  const form = new FormData();
  form.set('file', new File(['Dr. Brandt leitet das Projekt Nordlicht.'], 'projekt.txt'));
  const upload = await app.request(`/api/notebooks/${id}/sources/file`, {
    method: 'POST',
    headers: { cookie: owner },
    body: form,
  });
  SubmitSourceResultSchema.parse(await upload.json());
  await harness.runJobs();
  return { owner, notebookId: id };
}

const startGuest = () => app.request('/api/guest', { method: 'POST' });

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
});

afterAll(async () => {
  await harness.pool.end();
});

describe('POST /api/guest', () => {
  it('signs a guest in, with a copy of the example notebook that is theirs alone', async () => {
    const example = await makeExample();

    const response = await startGuest();

    expect(response.status).toBe(200);
    const { notebookId } = GuestStartSchema.parse(await response.json());
    const cookie = cookieOf(response);
    expect(cookie).not.toBe('');
    expect(notebookId).not.toBe(example.notebookId);
    const mine = NotebookListSchema.parse(
      await (await app.request('/api/notebooks', { headers: { cookie } })).json()
    );
    expect(mine.map((notebook) => notebook.id)).toEqual([notebookId]);
    expect(mine[0]?.title).toBe(DEMO_NOTEBOOK_TITLE);
    const sources = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebookId}/sources`, { headers: { cookie } })
      ).json()
    );
    expect(sources.map((source) => source.title)).toEqual(['projekt.txt']);
  });

  it('marks the guest as a guest in the session, and two guests do not see each other', async () => {
    await makeExample();

    const first = await startGuest();
    const second = await startGuest();

    const session = await harness.auth.handler(
      new Request(`${BASE_URL}/api/auth/get-session`, {
        headers: { cookie: cookieOf(first) },
      })
    );
    expect(((await session.json()) as { user: { isAnonymous: boolean } }).user.isAnonymous).toBe(
      true
    );
    const firstId = GuestStartSchema.parse(await first.clone().json()).notebookId;
    const secondList = NotebookListSchema.parse(
      await (await app.request('/api/notebooks', { headers: { cookie: cookieOf(second) } })).json()
    );
    expect(secondList.map((notebook) => notebook.id)).not.toContain(firstId);
  });

  it('answers 503 while there is no example notebook to copy, and makes no guest', async () => {
    const response = await startGuest();

    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.GUEST_UNAVAILABLE);
    const { rows } = await harness.pool.query('SELECT count(*)::int AS n FROM "user"');
    expect(rows[0].n).toBe(0);
  });

  it('answers 503 when too many guests were started within the hour', async () => {
    await makeExample();
    for (let i = 0; i < LIMITS.GUESTS_PER_HOUR; i += 1) {
      expect((await startGuest()).status).toBe(200);
    }

    const response = await startGuest();

    expect(response.status).toBe(503);
  });

  it('does not let anybody make a guest around the route, which would skip the copy and the limits', async () => {
    await makeExample();

    const response = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' });

    expect(response.status).toBe(404);
    const { rows } = await harness.pool.query(
      'SELECT count(*)::int AS n FROM "user" WHERE is_anonymous'
    );
    expect(rows[0].n).toBe(0);
  });
});
