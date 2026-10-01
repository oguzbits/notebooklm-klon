import {
  API_ERROR,
  ApiErrorSchema,
  NotebookListSchema,
  NotebookOverviewResponseSchema,
  NotebookSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatInput } from './ai/gemini-chat';
import { createApp } from './app';
import { NOTEBOOK_OVERVIEW_SYSTEM_PROMPT } from './core/notebook-overview-prompt';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';

let replies: string[] = [];
const modelInputs: ChatInput[] = [];
const harness = createHarness({
  model: async function* (input) {
    modelInputs.push(input);
    if (input.system !== NOTEBOOK_OVERVIEW_SYSTEM_PROMPT) {
      yield '{"statements":[]}';
      return;
    }
    yield replies.shift() ?? '{"emoji":"🔬","summary":"Es geht um **Nordlicht**."}';
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

async function createNotebook(cookie: string): Promise<string> {
  const created = await app.request('/api/notebooks', json(cookie, { title: 'N' }));
  return NotebookSchema.parse(await created.json()).id;
}

/** Uploads a text file into the notebook and lets the ingestion finish. */
async function addSource(cookie: string, notebook: string, name: string, text: string) {
  const form = new FormData();
  form.set('file', new File([text], name));
  const upload = await app.request(`/api/notebooks/${notebook}/sources/file`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  const { sourceId } = SubmitSourceResultSchema.parse(await upload.json());
  await harness.runJobs();
  return sourceId;
}

const overviewOf = (cookie: string, notebook: string) =>
  app.request(`/api/notebooks/${notebook}/overview`, { headers: { cookie } });

const overviewCalls = () =>
  modelInputs.filter((input) => input.system === NOTEBOOK_OVERVIEW_SYSTEM_PROMPT);

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  modelInputs.length = 0;
  replies = [];
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('GET /api/notebooks/:id/overview', () => {
  it('needs a session', async () => {
    expect((await app.request('/api/notebooks/x/overview')).status).toBe(401);
  });

  it('has nothing to say about a notebook without a ready source, and asks no model', async () => {
    const notebook = await createNotebook(alice);

    const response = await overviewOf(alice, notebook);

    expect(NotebookOverviewResponseSchema.parse(await response.json())).toEqual({ overview: null });
    expect(overviewCalls()).toEqual([]);
  });

  it('makes the overview from the sources once and serves the stored one afterwards', async () => {
    const notebook = await createNotebook(alice);
    await addSource(alice, notebook, 'projekt.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');

    const first = await overviewOf(alice, notebook);
    const second = await overviewOf(alice, notebook);

    const expected = { overview: { emoji: '🔬', summary: 'Es geht um **Nordlicht**.' } };
    expect(first.status).toBe(200);
    expect(NotebookOverviewResponseSchema.parse(await first.json())).toEqual(expected);
    expect(NotebookOverviewResponseSchema.parse(await second.json())).toEqual(expected);
    expect(overviewCalls()).toHaveLength(1);
    expect(overviewCalls()[0]?.user).toContain('projekt.txt');
  });

  it('gives the notebook the symbol of its overview, on the list as well', async () => {
    const notebook = await createNotebook(alice);
    await addSource(alice, notebook, 'projekt.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');
    const before = NotebookListSchema.parse(
      await (await app.request('/api/notebooks', { headers: { cookie: alice } })).json()
    );

    await overviewOf(alice, notebook);

    const after = NotebookListSchema.parse(
      await (await app.request('/api/notebooks', { headers: { cookie: alice } })).json()
    );
    expect(before.map((item) => item.emoji)).toEqual([null]);
    expect(after.map((item) => item.emoji)).toEqual(['🔬']);
  });

  it('makes it again when a source is added, and the notebook keeps its symbol', async () => {
    const notebook = await createNotebook(alice);
    await addSource(alice, notebook, 'projekt.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');
    await overviewOf(alice, notebook);
    await addSource(alice, notebook, 'budget.txt', 'Das Budget beträgt 1,25 Mio. Euro.');
    replies = ['{"emoji":"🧠","summary":"Jetzt auch das **Budget**."}'];

    const response = await overviewOf(alice, notebook);

    expect(NotebookOverviewResponseSchema.parse(await response.json())).toEqual({
      overview: { emoji: '🔬', summary: 'Jetzt auch das **Budget**.' },
    });
    expect(overviewCalls()).toHaveLength(2);
    expect(overviewCalls()[1]?.user).toContain('budget.txt');
  });

  it('answers 404 for the notebook of another user and for an unknown one', async () => {
    const theirs = await createNotebook(bob);
    await addSource(bob, theirs, 'geheim.txt', 'Nur für Bob.');

    for (const id of [theirs, '00000000-0000-4000-8000-000000000000', 'kein-uuid']) {
      const response = await overviewOf(alice, id);
      expect(response.status).toBe(404);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.NOT_FOUND);
    }
    expect(overviewCalls()).toEqual([]);
  });

  it('fails when the model returns no overview, stores nothing, and works on the next try', async () => {
    const notebook = await createNotebook(alice);
    await addSource(alice, notebook, 'projekt.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');
    replies = ['{"emoji":"Roboter","summary":"x"}'];

    const failed = await overviewOf(alice, notebook);
    const retried = await overviewOf(alice, notebook);

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(200);
    expect(overviewCalls()).toHaveLength(2);
  });
});
