import {
  API_ERROR,
  CHAT_LENGTH,
  CHAT_STYLE,
  ChatConfigSchema,
  DEFAULT_CHAT_CONFIG,
  NotebookSchema,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_FEEDBACK,
  STUDIO_KIND,
  STUDIO_SIZE,
  StudioOutputListSchema,
  StudioOutputSchema,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { ChatInput } from './ai/gemini-chat';
import { createApp } from './app';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const modelInputs: ChatInput[] = [];
let reply = '';

const harness = createHarness({
  model: async function* (input) {
    modelInputs.push(input);
    yield reply;
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

const send = (method: string, cookie: string, body?: unknown) => ({
  method,
  headers: { cookie, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function createNotebook(cookie: string, text?: string, fileName = 'projekt.txt') {
  const created = await app.request('/api/notebooks', send('POST', cookie, { title: 'N' }));
  const id = NotebookSchema.parse(await created.json()).id;
  if (text !== undefined) {
    const form = new FormData();
    form.set('file', new File([text], fileName));
    const upload = await app.request(`/api/notebooks/${id}/sources/file`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    SubmitSourceResultSchema.parse(await upload.json());
    await harness.runJobs();
  }
  return id;
}

const flashcardsReply = JSON.stringify({
  title: 'Projekt-Lernkarten',
  cards: [
    { front: 'Wer leitet es?', back: 'Dr. Brandt', chunkIds: ['c1'] },
    { front: 'Erfunden?', back: 'Ja', chunkIds: ['c9'] },
  ],
});

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.enqueued.length = 0;
  modelInputs.length = 0;
  reply = flashcardsReply;
  alice = await signUp('alice@example.test');
  bob = await signUp('bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('studio routes', () => {
  it('need a session', async () => {
    expect((await app.request('/api/notebooks/x/studio')).status).toBe(401);
    expect((await app.request('/api/notebooks/x/chat-config')).status).toBe(401);
  });

  it('makes flashcards from the selected sources, with checked citations, and saves them', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS })
    );

    expect(response.status).toBe(201);
    const output = StudioOutputSchema.parse(await response.json());
    expect(output.kind).toBe(STUDIO_KIND.FLASHCARDS);
    if (output.kind !== STUDIO_KIND.FLASHCARDS) throw new Error('wrong kind');
    expect(output.content.cards).toHaveLength(1);
    // The model names the set, and the output says how it was asked for and is not read yet.
    expect(output.title).toBe('Projekt-Lernkarten');
    expect(output).toMatchObject({ unread: true, feedback: null });
    const [card] = output.content.cards;
    const stored = await harness.pool.query('SELECT id FROM chunks WHERE id = $1', [
      card?.chunkIds[0],
    ]);
    expect(stored.rowCount).toBe(1);
    expect(modelInputs).toHaveLength(1);
    expect(modelInputs[0]?.user).toContain('Dr. Brandt leitet das Projekt.');

    const list = await app.request(`/api/notebooks/${notebook}/studio`, {
      headers: { cookie: alice },
    });
    expect(StudioOutputListSchema.parse(await list.json()).map((item) => item.id)).toEqual([
      output.id,
    ]);
  });

  it('tells the model the size, the difficulty and the topic, and keeps the request with the output', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, {
        kind: STUDIO_KIND.FLASHCARDS,
        size: STUDIO_SIZE.MORE,
        difficulty: STUDIO_DIFFICULTY.HARD,
        focus: 'Nur die Leitung',
      })
    );

    expect(response.status).toBe(201);
    const output = StudioOutputSchema.parse(await response.json());
    expect(modelInputs[0]?.system).toMatch(/eighteen to twenty-five/);
    expect(modelInputs[0]?.system).toMatch(/hard/i);
    expect(modelInputs[0]?.system).toContain('Nur die Leitung');
    expect(output.request?.prompt).toMatch(/Mehr/);
    expect(output.request?.prompt).toContain('Nur die Leitung');
    expect(output.request?.sources).toMatchObject([{ title: 'projekt.txt' }]);
  });

  it('uses only the sources the reader picked, and never one that is not selected or foreign', async () => {
    const notebook = await createNotebook(alice, 'ERSTER-TEXT Dr. Brandt.', 'eins.txt');
    const second = await createNotebook(alice, 'ZWEITER-TEXT Dr. Weiß.', 'zwei.txt');
    const bobs = await createNotebook(bob, 'FREMDER-TEXT', 'fremd.txt');
    const sourcesOf = async (id: string, cookie: string) =>
      (await (
        await app.request(`/api/notebooks/${id}/sources`, { headers: { cookie } })
      ).json()) as {
        id: string;
        title: string;
      }[];
    const [first] = await sourcesOf(notebook, alice);
    const [elsewhere] = await sourcesOf(second, alice);
    const [foreign] = await sourcesOf(bobs, bob);
    if (!first || !elsewhere || !foreign) throw new Error('sources missing');

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, {
        kind: STUDIO_KIND.FLASHCARDS,
        sourceIds: [first.id, elsewhere.id, foreign.id],
      })
    );

    expect(response.status).toBe(201);
    expect(modelInputs[0]?.user).toContain('ERSTER-TEXT');
    expect(modelInputs[0]?.user).not.toContain('ZWEITER-TEXT');
    expect(modelInputs[0]?.user).not.toContain('FREMDER-TEXT');
    const picked = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS, sourceIds: [elsewhere.id] })
    );
    // A source of another notebook is no source of this one: nothing to work on.
    expect(picked.status).toBe(409);
  });

  it('makes a report in the requested format', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');
    reply = JSON.stringify({
      title: 'Häufige Fragen',
      sections: [
        { heading: 'Wer leitet es?', statements: [{ text: 'Dr. Brandt.', chunkIds: ['c1'] }] },
      ],
    });

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ })
    );

    expect(response.status).toBe(201);
    expect(StudioOutputSchema.parse(await response.json())).toMatchObject({
      kind: STUDIO_KIND.REPORT,
      format: REPORT_FORMAT.FAQ,
      title: 'Häufige Fragen',
    });
    expect(modelInputs[0]?.system).toMatch(/FAQ/);
  });

  it('answers 409 without calling the model when no source is ready and selected', async () => {
    const empty = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${empty}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.QUIZ })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: API_ERROR.NO_SOURCES_SELECTED });
    expect(modelInputs).toEqual([]);
  });

  it('answers 422 and saves nothing when no part of the output is supported', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');
    reply = JSON.stringify({
      title: 'Lernkarten',
      cards: [{ front: 'F', back: 'B', chunkIds: ['c9'] }],
    });

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS })
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: API_ERROR.STUDIO_EMPTY });
    const list = await app.request(`/api/notebooks/${notebook}/studio`, {
      headers: { cookie: alice },
    });
    expect(await list.json()).toEqual([]);
  });

  it('rejects a report the reader writes without the instruction', async () => {
    const notebook = await createNotebook(alice, 'Text.');

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.CUSTOM })
    );

    expect(response.status).toBe(400);
    expect(modelInputs).toEqual([]);
  });

  it('rejects a request for a report without a format', async () => {
    const notebook = await createNotebook(alice, 'Text.');

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.REPORT })
    );

    expect(response.status).toBe(400);
  });

  it("does not show, make or delete anything in another user's notebook", async () => {
    const notebook = await createNotebook(alice, 'GEHEIMER-TEXT');
    const made = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS })
    );
    const { id } = StudioOutputSchema.parse(await made.json());
    modelInputs.length = 0;

    const list = await app.request(`/api/notebooks/${notebook}/studio`, {
      headers: { cookie: bob },
    });
    const create = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', bob, { kind: STUDIO_KIND.FLASHCARDS })
    );
    const remove = await app.request(
      `/api/notebooks/${notebook}/studio/${id}`,
      send('DELETE', bob)
    );

    expect([list.status, create.status, remove.status]).toEqual([404, 404, 404]);
    expect(modelInputs).toEqual([]);
  });

  it('renames an output, keeps what the reader thought of it and clears the unread mark', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');
    const made = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS })
    );
    const { id } = StudioOutputSchema.parse(await made.json());
    const patch = (cookie: string, body: unknown) =>
      app.request(`/api/notebooks/${notebook}/studio/${id}`, send('PATCH', cookie, body));

    const renamed = await patch(alice, { title: '  Mein Name  ' });
    const rated = await patch(alice, { feedback: STUDIO_FEEDBACK.BAD });
    const read = await patch(alice, { read: true });

    expect(StudioOutputSchema.parse(await renamed.json())).toMatchObject({ title: 'Mein Name' });
    expect(StudioOutputSchema.parse(await rated.json())).toMatchObject({
      feedback: STUDIO_FEEDBACK.BAD,
    });
    expect(StudioOutputSchema.parse(await read.json())).toMatchObject({
      unread: false,
      title: 'Mein Name',
      feedback: STUDIO_FEEDBACK.BAD,
    });
    expect((await patch(alice, {})).status).toBe(400);
    expect((await patch(alice, { title: '   ' })).status).toBe(400);
    expect((await patch(bob, { title: 'Meins' })).status).toBe(404);
    expect(
      (await app.request(`/api/notebooks/${notebook}/studio/${id}`, { method: 'PATCH' })).status
    ).toBe(401);
  });

  it('deletes an output', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');
    const made = await app.request(
      `/api/notebooks/${notebook}/studio`,
      send('POST', alice, { kind: STUDIO_KIND.FLASHCARDS })
    );
    const { id } = StudioOutputSchema.parse(await made.json());

    const removed = await app.request(
      `/api/notebooks/${notebook}/studio/${id}`,
      send('DELETE', alice)
    );
    const again = await app.request(
      `/api/notebooks/${notebook}/studio/${id}`,
      send('DELETE', alice)
    );

    expect([removed.status, again.status]).toEqual([204, 404]);
  });
});

describe('chat config routes', () => {
  it('serve the default until a config is saved, then the saved one', async () => {
    const notebook = await createNotebook(alice);
    const config = { ...DEFAULT_CHAT_CONFIG, length: CHAT_LENGTH.LONGER };

    const before = await app.request(`/api/notebooks/${notebook}/chat-config`, {
      headers: { cookie: alice },
    });
    const saved = await app.request(
      `/api/notebooks/${notebook}/chat-config`,
      send('PUT', alice, config)
    );
    const after = await app.request(`/api/notebooks/${notebook}/chat-config`, {
      headers: { cookie: alice },
    });

    expect(ChatConfigSchema.parse(await before.json())).toEqual(DEFAULT_CHAT_CONFIG);
    expect(saved.status).toBe(200);
    expect(ChatConfigSchema.parse(await after.json())).toEqual(config);
  });

  it('reject a custom style without an instruction', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/chat-config`,
      send('PUT', alice, { ...DEFAULT_CHAT_CONFIG, style: CHAT_STYLE.CUSTOM })
    );

    expect(response.status).toBe(400);
  });

  it("do not reach into another user's notebook", async () => {
    const notebook = await createNotebook(alice);

    const read = await app.request(`/api/notebooks/${notebook}/chat-config`, {
      headers: { cookie: bob },
    });
    const write = await app.request(
      `/api/notebooks/${notebook}/chat-config`,
      send('PUT', bob, DEFAULT_CHAT_CONFIG)
    );

    expect([read.status, write.status]).toEqual([404, 404]);
  });

  it('change what the chat tells the model', async () => {
    const notebook = await createNotebook(alice, 'Dr. Brandt leitet das Projekt.');
    await app.request(
      `/api/notebooks/${notebook}/chat-config`,
      send('PUT', alice, { ...DEFAULT_CHAT_CONFIG, length: CHAT_LENGTH.SHORTER })
    );
    reply = '{"statements":[{"text":"Antwort.","chunkIds":["c1"]}]}';

    await app.request(
      `/api/notebooks/${notebook}/chat`,
      send('POST', alice, { question: 'Wer leitet es?' })
    );

    expect(modelInputs.at(-1)?.system).toMatch(/short/i);
  });
});
