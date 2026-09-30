import {
  API_ERROR,
  ApiErrorSchema,
  CHAT_ROLE,
  ChatMessageListSchema,
  NotebookSchema,
  NoteListSchema,
  NoteSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
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

const send = (method: string, cookie: string, body?: unknown) => ({
  method,
  headers: { cookie, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** A notebook with a ready source and one finished chat turn. Returns the notebook and the answer. */
async function answeredNotebook(cookie: string) {
  const created = await app.request('/api/notebooks', send('POST', cookie, { title: 'N' }));
  const notebook = NotebookSchema.parse(await created.json()).id;
  const form = new FormData();
  form.set('file', new File(['Dr. Brandt leitet das Projekt Nordlicht.'], 'projekt.txt'));
  const upload = await app.request(`/api/notebooks/${notebook}/sources/file`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  SubmitSourceResultSchema.parse(await upload.json());
  await harness.runJobs();
  await (
    await app.request(`/api/notebooks/${notebook}/chat`, send('POST', cookie, { question: 'Wer?' }))
  ).text();
  const history = ChatMessageListSchema.parse(
    await (await app.request(`/api/notebooks/${notebook}/messages`, { headers: { cookie } })).json()
  );
  const answer = history.find((message) => message.role === CHAT_ROLE.ASSISTANT);
  const question = history.find((message) => message.role === CHAT_ROLE.USER);
  if (!answer || !question) throw new Error('expected a finished chat turn');
  return { notebook, answerId: answer.id, questionId: question.id };
}

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('notes', () => {
  it('needs a session', async () => {
    expect((await app.request('/api/notebooks/x/notes')).status).toBe(401);
    expect((await app.request('/api/notebooks/x/notes', { method: 'POST' })).status).toBe(401);
  });

  it('is empty for a new notebook and hides the notebook of another user', async () => {
    const { notebook } = await answeredNotebook(bob);

    const own = await app.request('/api/notebooks', send('POST', alice, { title: 'Leer' }));
    const ownId = NotebookSchema.parse(await own.json()).id;

    const empty = await app.request(`/api/notebooks/${ownId}/notes`, {
      headers: { cookie: alice },
    });
    const foreign = await app.request(`/api/notebooks/${notebook}/notes`, {
      headers: { cookie: alice },
    });

    expect(await empty.json()).toEqual([]);
    expect(foreign.status).toBe(404);
  });

  it('saves an answer as a note with the citations the server checked', async () => {
    const { notebook, answerId } = await answeredNotebook(alice);

    const created = await app.request(
      `/api/notebooks/${notebook}/notes`,
      send('POST', alice, { messageId: answerId })
    );
    const list = await app.request(`/api/notebooks/${notebook}/notes`, {
      headers: { cookie: alice },
    });

    expect(created.status).toBe(201);
    const note = NoteSchema.parse(await created.json());
    expect(note.messageId).toBe(answerId);
    expect(note.statements[0]?.text).toBe('Antwort.');
    expect(NoteListSchema.parse(await list.json())).toEqual([note]);
  });

  it('does not take content from the client', async () => {
    const { notebook, answerId } = await answeredNotebook(alice);

    const created = await app.request(
      `/api/notebooks/${notebook}/notes`,
      send('POST', alice, {
        messageId: answerId,
        statements: [{ text: 'Erfunden.', chunkIds: ['x'] }],
      })
    );

    expect(NoteSchema.parse(await created.json()).statements[0]?.text).toBe('Antwort.');
  });

  it('answers 404 for a question, for the answer of another user and for a missing answer', async () => {
    const mine = await answeredNotebook(alice);
    const theirs = await answeredNotebook(bob);

    for (const messageId of [mine.questionId, theirs.answerId]) {
      const response = await app.request(
        `/api/notebooks/${mine.notebook}/notes`,
        send('POST', alice, { messageId })
      );
      expect(response.status).toBe(404);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.NOT_FOUND);
    }
  });

  it('answers 400 for a body without a valid message ID', async () => {
    const { notebook } = await answeredNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/notes`,
      send('POST', alice, { messageId: 'x' })
    );

    expect(response.status).toBe(400);
  });

  it('deletes an own note once and never the note of another user', async () => {
    const mine = await answeredNotebook(alice);
    const theirs = await answeredNotebook(bob);
    const note = NoteSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${theirs.notebook}/notes`,
          send('POST', bob, { messageId: theirs.answerId })
        )
      ).json()
    );
    const own = NoteSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${mine.notebook}/notes`,
          send('POST', alice, { messageId: mine.answerId })
        )
      ).json()
    );

    const foreign = await app.request(
      `/api/notebooks/${theirs.notebook}/notes/${note.id}`,
      send('DELETE', alice)
    );
    const first = await app.request(
      `/api/notebooks/${mine.notebook}/notes/${own.id}`,
      send('DELETE', alice)
    );
    const second = await app.request(
      `/api/notebooks/${mine.notebook}/notes/${own.id}`,
      send('DELETE', alice)
    );

    expect([foreign.status, first.status, second.status]).toEqual([404, 204, 404]);
  });
});
