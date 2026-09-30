import {
  API_ERROR,
  ApiErrorSchema,
  CHAT_ROLE,
  ChatMessageListSchema,
  ChunkDetailSchema,
  NotebookSchema,
  SourceTextSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatInput } from './ai/gemini-chat';
import { createApp } from './app';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const ANSWER = '{"statements":[{"text":"Dr. Brandt leitet es.","chunkIds":["c1"]}]}';

// The model of the harness is swapped per test through this variable.
let model: (input: ChatInput) => AsyncIterable<string> = async function* () {
  yield ANSWER;
};
const harness = createHarness({ model: (input) => model(input) });
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

const post = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const get = (cookie: string) => ({ headers: { cookie } });

async function createNotebook(cookie: string): Promise<string> {
  const response = await app.request('/api/notebooks', post(cookie, { title: 'N' }));
  return NotebookSchema.parse(await response.json()).id;
}

async function addText(cookie: string, notebook: string, text: string): Promise<string> {
  const form = new FormData();
  form.set('file', new File([text], 'projekt.txt'));
  const response = await app.request(`/api/notebooks/${notebook}/sources/file`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  return SubmitSourceResultSchema.parse(await response.json()).sourceId;
}

async function ask(cookie: string, notebook: string, question: string): Promise<Response> {
  const response = await app.request(`/api/notebooks/${notebook}/chat`, post(cookie, { question }));
  await response.clone().text();
  return response;
}

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  model = async function* () {
    yield ANSWER;
  };
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('GET /api/notebooks/:id/sources/:sourceId/text', () => {
  it('needs a session', async () => {
    const response = await app.request('/api/notebooks/x/sources/y/text');

    expect(response.status).toBe(401);
  });

  it('returns the extracted text of a processed source', async () => {
    const notebook = await createNotebook(alice);
    const sourceId = await addText(alice, notebook, 'Dr. Brandt leitet das Projekt Nordlicht.');
    await harness.runJobs();

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/${sourceId}/text`,
      get(alice)
    );

    expect(response.status).toBe(200);
    expect(SourceTextSchema.parse(await response.json())).toMatchObject({
      id: sourceId,
      title: 'projekt.txt',
      text: 'Dr. Brandt leitet das Projekt Nordlicht.',
    });
  });

  it('answers 404 while the source has no text yet', async () => {
    const notebook = await createNotebook(alice);
    const pending = await addText(alice, notebook, 'noch nicht verarbeitet');

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/${pending}/text`,
      get(alice)
    );

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.NOT_FOUND);
  });

  it('answers 404 for a source of another user, through either notebook', async () => {
    const notebook = await createNotebook(alice);
    const bobsBook = await createNotebook(bob);
    const bobsSource = await addText(bob, bobsBook, 'geheim');
    await harness.runJobs();

    for (const path of [
      `/api/notebooks/${notebook}/sources/${bobsSource}/text`,
      `/api/notebooks/${bobsBook}/sources/${bobsSource}/text`,
    ]) {
      const response = await app.request(path, get(alice));

      expect(response.status).toBe(404);
    }
  });
});

describe('GET /api/notebooks/:id/chunks/:chunkId', () => {
  it('returns a cited passage with its source and offsets', async () => {
    const notebook = await createNotebook(alice);
    const sourceId = await addText(alice, notebook, 'Dr. Brandt leitet das Projekt Nordlicht.');
    await harness.runJobs();
    const { rows } = await harness.pool.query('SELECT id FROM chunks WHERE source_id = $1', [
      sourceId,
    ]);

    const response = await app.request(
      `/api/notebooks/${notebook}/chunks/${rows[0].id}`,
      get(alice)
    );

    expect(response.status).toBe(200);
    expect(ChunkDetailSchema.parse(await response.json())).toMatchObject({
      id: rows[0].id,
      sourceId,
      sourceTitle: 'projekt.txt',
      text: 'Dr. Brandt leitet das Projekt Nordlicht.',
      startOffset: 0,
    });
  });

  it("answers 404 for a passage of another user's source", async () => {
    const notebook = await createNotebook(alice);
    const bobsBook = await createNotebook(bob);
    const bobsSource = await addText(bob, bobsBook, 'geheim');
    await harness.runJobs();
    const { rows } = await harness.pool.query('SELECT id FROM chunks WHERE source_id = $1', [
      bobsSource,
    ]);

    const response = await app.request(
      `/api/notebooks/${notebook}/chunks/${rows[0].id}`,
      get(alice)
    );

    expect(response.status).toBe(404);
  });
});

describe('chat history', () => {
  it('needs a session and hides the notebook of another user', async () => {
    const bobsBook = await createNotebook(bob);

    expect((await app.request(`/api/notebooks/${bobsBook}/messages`)).status).toBe(401);
    expect((await app.request(`/api/notebooks/${bobsBook}/messages`, get(alice))).status).toBe(404);
  });

  it('is empty for a new notebook', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(`/api/notebooks/${notebook}/messages`, get(alice));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('saves the question and the checked answer of a chat turn', async () => {
    const notebook = await createNotebook(alice);
    const sourceId = await addText(alice, notebook, 'Dr. Brandt leitet das Projekt Nordlicht.');
    await harness.runJobs();
    await ask(alice, notebook, 'Wer leitet es?');

    const response = await app.request(`/api/notebooks/${notebook}/messages`, get(alice));

    const messages = ChatMessageListSchema.parse(await response.json());
    expect(messages.map((message) => message.role)).toEqual([CHAT_ROLE.USER, CHAT_ROLE.ASSISTANT]);
    expect(messages[0]).toMatchObject({ text: 'Wer leitet es?' });
    const answer = messages[1];
    if (answer?.role !== CHAT_ROLE.ASSISTANT) throw new Error('expected an assistant message');
    expect(answer.statements).toHaveLength(1);
    const chunkIds = answer.statements[0]?.chunkIds ?? [];
    const { rows } = await harness.pool.query(
      'SELECT source_id FROM chunks WHERE id = ANY($1::uuid[])',
      [chunkIds]
    );
    expect(rows).toEqual([{ source_id: sourceId }]);
  });

  it('saves nothing when the question is rejected because no source is ready', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'noch nicht verarbeitet');
    await ask(alice, notebook, 'Was?');

    const response = await app.request(`/api/notebooks/${notebook}/messages`, get(alice));

    expect(await response.json()).toEqual([]);
  });

  it('keeps the statements that arrived before the model failed', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'Text zum Antworten');
    await harness.runJobs();
    model = async function* () {
      yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]},';
      throw new Error('Verbindung weg');
    };
    await ask(alice, notebook, 'Frage?');

    const response = await app.request(`/api/notebooks/${notebook}/messages`, get(alice));

    const messages = ChatMessageListSchema.parse(await response.json());
    const answer = messages[1];
    if (answer?.role !== CHAT_ROLE.ASSISTANT) throw new Error('expected an assistant message');
    expect(answer.statements.map((statement) => statement.text)).toEqual(['Eins.']);
  });
});
