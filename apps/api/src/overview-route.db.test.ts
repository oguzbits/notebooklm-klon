import { NotebookSchema, SourceOverviewSchema, SubmitSourceResultSchema } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatInput } from './ai/gemini-chat';
import { createApp } from './app';
import { OVERVIEW_SYSTEM_PROMPT } from './core/overview-prompt';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const OVERVIEW = {
  summary: 'Dr. Brandt leitet das Projekt Nordlicht.',
  keyTopics: ['Nordlicht'],
  suggestedQuestions: ['Wer leitet das Projekt?'],
};

const overviewInputs: ChatInput[] = [];
const harness = createHarness({
  model: async function* (input) {
    overviewInputs.push(input);
    yield input.system === OVERVIEW_SYSTEM_PROMPT ? JSON.stringify(OVERVIEW) : '{"statements":[]}';
  },
});
const app = createApp(harness.deps);

async function signUp(email: string): Promise<string> {
  const response = await harness.auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ name: email, email, password: PASSWORD }),
    })
  );
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
}

const json = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

async function createSource(cookie: string, text: string) {
  const created = await app.request('/api/notebooks', json(cookie, { title: 'N' }));
  const notebook = NotebookSchema.parse(await created.json()).id;
  const form = new FormData();
  form.set('file', new File([text], 'projekt.txt'));
  const upload = await app.request(`/api/notebooks/${notebook}/sources/file`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  const { sourceId } = SubmitSourceResultSchema.parse(await upload.json());
  return { notebook, sourceId };
}

const overviewOf = (cookie: string, notebook: string, source: string) =>
  app.request(`/api/notebooks/${notebook}/sources/${source}/overview`, { headers: { cookie } });

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  overviewInputs.length = 0;
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('GET /api/notebooks/:id/sources/:sourceId/overview', () => {
  it('needs a session', async () => {
    const response = await app.request('/api/notebooks/x/sources/y/overview');

    expect(response.status).toBe(401);
  });

  it('makes the overview on first request and serves the stored one afterwards', async () => {
    const { notebook, sourceId } = await createSource(alice, 'Dr. Brandt leitet das Projekt.');
    await harness.runJobs();

    const first = await overviewOf(alice, notebook, sourceId);
    const second = await overviewOf(alice, notebook, sourceId);

    expect(first.status).toBe(200);
    expect(SourceOverviewSchema.parse(await first.json())).toEqual(OVERVIEW);
    expect(SourceOverviewSchema.parse(await second.json())).toEqual(OVERVIEW);
    expect(overviewInputs).toHaveLength(1);
    expect(overviewInputs[0]?.user).toContain('Dr. Brandt leitet das Projekt.');
  });

  it('answers 404 while the source is not read yet, without calling the model', async () => {
    const { notebook, sourceId } = await createSource(alice, 'noch nicht verarbeitet');

    const response = await overviewOf(alice, notebook, sourceId);

    expect(response.status).toBe(404);
    expect(overviewInputs).toEqual([]);
  });

  it("answers 404 for another user's source and never gives the model its text", async () => {
    const { notebook: bobsBook, sourceId: bobsSource } = await createSource(bob, 'GEHEIMER-TEXT');
    await harness.runJobs();
    const { notebook: alicesBook } = await createSource(alice, 'eigener Text');

    const throughOwnBook = await overviewOf(alice, alicesBook, bobsSource);
    const throughTheirBook = await overviewOf(alice, bobsBook, bobsSource);

    expect(throughOwnBook.status).toBe(404);
    expect(throughTheirBook.status).toBe(404);
    expect(overviewInputs).toEqual([]);
  });
});
