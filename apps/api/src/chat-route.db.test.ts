import {
  API_ERROR,
  ApiErrorSchema,
  CHAT_EVENT,
  CHAT_ROLE,
  type ChatEvent,
  ChatEventSchema,
  ChatMessageListSchema,
  NotebookSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { GeminiError } from './ai/gemini-error';
import { createApp } from './app';
import { LIMITS } from './config/limits';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';

const harness = createHarness();
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

async function createNotebook(cookie: string): Promise<string> {
  const response = await app.request('/api/notebooks', post(cookie, { title: 'N' }));
  return NotebookSchema.parse(await response.json()).id;
}

async function addText(
  cookie: string,
  notebook: string,
  name: string,
  text: string
): Promise<string> {
  const form = new FormData();
  form.set('file', new File([text], name));
  const response = await app.request(`/api/notebooks/${notebook}/sources/file`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  return SubmitSourceResultSchema.parse(await response.json()).sourceId;
}

async function events(response: Response): Promise<ChatEvent[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => ChatEventSchema.parse(JSON.parse(line.slice('data:'.length))));
}

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  harness.modelInputs.length = 0;
  harness.errors.length = 0;
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('POST /api/notebooks/:id/chat', () => {
  it('needs a session', async () => {
    const response = await app.request('/api/notebooks/x/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(response.status).toBe(401);
  });

  it("answers 404 for another user's notebook", async () => {
    const bobs = await createNotebook(bob);

    const response = await app.request(
      `/api/notebooks/${bobs}/chat`,
      post(alice, { question: 'Hallo?' })
    );

    expect(response.status).toBe(404);
  });

  it('answers 400 for an empty question and for a body that is not JSON', async () => {
    const notebook = await createNotebook(alice);

    const empty = await app.request(
      `/api/notebooks/${notebook}/chat`,
      post(alice, { question: '  ' })
    );
    const broken = await app.request(`/api/notebooks/${notebook}/chat`, {
      method: 'POST',
      headers: { cookie: alice, 'content-type': 'application/json' },
      body: 'kein json',
    });

    for (const response of [empty, broken]) {
      expect(response.status).toBe(400);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.INVALID_REQUEST);
    }
  });

  it('answers 409 while no source is ready, without calling the model', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'a.txt', 'noch nicht verarbeitet');

    const response = await app.request(
      `/api/notebooks/${notebook}/chat`,
      post(alice, { question: 'Was?' })
    );

    expect(response.status).toBe(409);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.NO_SOURCES_SELECTED);
    expect(harness.modelInputs).toEqual([]);
  });

  it('gives each user a number of questions an hour and refuses the next before the model', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'a.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');
    await harness.runJobs();
    const ask = (cookie: string, nb: string) =>
      app.request(`/api/notebooks/${nb}/chat`, post(cookie, { question: 'Wer leitet es?' }));

    for (let i = 0; i < LIMITS.CHAT_QUESTIONS_PER_USER_PER_HOUR; i += 1) {
      const answered = await ask(alice, notebook);
      expect(answered.status).toBe(200);
      // Read to the end: an answer nobody reads is still saved in the background, which would run into the next test.
      await answered.text();
    }
    const calls = harness.modelInputs.length;
    const refused = await ask(alice, notebook);

    expect(refused.status).toBe(429);
    expect(ApiErrorSchema.parse(await refused.json()).code).toBe(API_ERROR.CHAT_LIMIT_REACHED);
    expect(harness.modelInputs).toHaveLength(calls);
    const history = await app.request(`/api/notebooks/${notebook}/messages`, {
      headers: { cookie: alice },
    });
    expect(
      ChatMessageListSchema.parse(await history.json()).filter((m) => m.role === CHAT_ROLE.USER)
    ).toHaveLength(LIMITS.CHAT_QUESTIONS_PER_USER_PER_HOUR);

    const bobsNotebook = await createNotebook(bob);
    await addText(bob, bobsNotebook, 'b.txt', 'Bobs Text.');
    await harness.runJobs();
    expect((await ask(bob, bobsNotebook)).status).toBe(200);
  });

  it('streams the answer with real chunk IDs of a source of the user', async () => {
    const notebook = await createNotebook(alice);
    const sourceId = await addText(
      alice,
      notebook,
      'projekt.txt',
      'Dr. Brandt leitet das Projekt Nordlicht.'
    );
    await harness.runJobs();

    const response = await app.request(
      `/api/notebooks/${notebook}/chat`,
      post(alice, { question: 'Wer leitet es?' })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
    const received = await events(response);
    expect(received.map((event) => event.type)).toEqual([CHAT_EVENT.STATEMENT, CHAT_EVENT.DONE]);
    const statement = received[0];
    if (statement?.type !== CHAT_EVENT.STATEMENT) throw new Error('expected a statement');
    const rows = await harness.pool.query(
      'SELECT source_id, text FROM chunks WHERE id = ANY($1::uuid[])',
      [statement.chunkIds]
    );
    expect(rows.rows).toEqual([
      { source_id: sourceId, text: 'Dr. Brandt leitet das Projekt Nordlicht.' },
    ]);
    expect(harness.modelInputs[0]?.user).toContain('Dr. Brandt leitet das Projekt Nordlicht.');
    expect(harness.modelInputs[0]?.user).toContain('Question: Wer leitet es?');
  });

  it('keeps how the answer came about, so the history can show it', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'projekt.txt', 'Dr. Brandt leitet das Projekt Nordlicht.');
    await harness.runJobs();
    await (
      await app.request(`/api/notebooks/${notebook}/chat`, post(alice, { question: 'Wer?' }))
    ).text();

    const history = ChatMessageListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/messages`, { headers: { cookie: alice } })
      ).json()
    );

    const answer = history.find((message) => message.role === CHAT_ROLE.ASSISTANT);
    expect(answer).toMatchObject({
      trace: { sourcesSearched: 1, passagesFound: 1, droppedStatements: 0, strippedCitations: 0 },
    });
  });

  it('never gives the model text of a deselected source or of another user', async () => {
    const notebook = await createNotebook(alice);
    const bobsBook = await createNotebook(bob);
    const kept = await addText(alice, notebook, 'behalten.txt', 'BEHALTENER-TEXT');
    const dropped = await addText(alice, notebook, 'abgewaehlt.txt', 'ABGEWAEHLTER-TEXT');
    await addText(bob, bobsBook, 'fremd.txt', 'FREMDER-TEXT');
    await harness.runJobs();
    await app.request(`/api/notebooks/${notebook}/sources/${dropped}`, {
      method: 'PATCH',
      headers: { cookie: alice, 'content-type': 'application/json' },
      body: JSON.stringify({ selected: false }),
    });

    await (
      await app.request(
        `/api/notebooks/${notebook}/chat`,
        post(alice, { question: 'Was steht drin?' })
      )
    ).text();

    const sent = harness.modelInputs[0]?.user ?? '';
    expect(sent).toContain('BEHALTENER-TEXT');
    expect(sent).not.toContain('ABGEWAEHLTER-TEXT');
    expect(sent).not.toContain('FREMDER-TEXT');
    expect(kept).not.toBe(dropped);
  });

  it('gives the model a signal that ends the request when the reader leaves', async () => {
    const notebook = await createNotebook(alice);
    await addText(alice, notebook, 'a.txt', 'Text zum Antworten');
    await harness.runJobs();

    await (
      await app.request(`/api/notebooks/${notebook}/chat`, post(alice, { question: 'Frage?' }))
    ).text();

    expect(harness.modelInputs[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('ends the stream with an error event when the model fails midway', async () => {
    const failing = createHarness({
      model: async function* () {
        yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]},';
        throw new Error('Verbindung weg');
      },
    });
    const failingApp = createApp(failing.deps);
    const cookie = await (async () => {
      const response = await failing.auth.handler(
        new Request(`${BASE_URL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: BASE_URL },
          body: JSON.stringify({ name: 'c', email: 'c@example.test', password: PASSWORD }),
        })
      );
      return response.headers
        .getSetCookie()
        .map((entry) => entry.split(';')[0])
        .join('; ');
    })();
    const notebook = NotebookSchema.parse(
      await (await failingApp.request('/api/notebooks', post(cookie, { title: 'N' }))).json()
    ).id;
    const form = new FormData();
    form.set('file', new File(['Text zum Antworten'], 'a.txt'));
    await failingApp.request(`/api/notebooks/${notebook}/sources/file`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    await failing.runJobs();

    const response = await failingApp.request(
      `/api/notebooks/${notebook}/chat`,
      post(cookie, { question: 'Frage?' })
    );

    expect(response.status).toBe(200);
    const received = await events(response);
    expect(received.map((event) => event.type)).toEqual([CHAT_EVENT.STATEMENT, CHAT_EVENT.ERROR]);
    expect(failing.errors).toHaveLength(1);
    await failing.pool.end();
  });

  it('answers 429 when the embedding quota of the provider is used up', async () => {
    const limited = createHarness({
      embedQuery: async () => {
        throw new GeminiError(429, 'quota');
      },
    });
    const limitedApp = createApp(limited.deps);
    const signUpResponse = await limited.auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ name: 'd', email: 'd@example.test', password: PASSWORD }),
      })
    );
    const cookie = signUpResponse.headers
      .getSetCookie()
      .map((entry) => entry.split(';')[0])
      .join('; ');
    const notebook = NotebookSchema.parse(
      await (await limitedApp.request('/api/notebooks', post(cookie, { title: 'N' }))).json()
    ).id;
    const form = new FormData();
    form.set('file', new File(['Text'], 'a.txt'));
    await limitedApp.request(`/api/notebooks/${notebook}/sources/file`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    await limited.runJobs();

    const response = await limitedApp.request(
      `/api/notebooks/${notebook}/chat`,
      post(cookie, { question: 'Frage?' })
    );

    expect(response.status).toBe(429);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.CHAT_LIMIT_REACHED);
    await limited.pool.end();
  });
});
