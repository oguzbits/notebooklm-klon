import {
  API_ERROR,
  CHAT_LENGTH,
  CHAT_STYLE,
  ChatConfigSchema,
  DEFAULT_CHAT_CONFIG,
  NotebookSchema,
  REPORT_FORMAT,
  STUDIO_KIND,
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

async function createNotebook(cookie: string, text?: string) {
  const created = await app.request('/api/notebooks', send('POST', cookie, { title: 'N' }));
  const id = NotebookSchema.parse(await created.json()).id;
  if (text !== undefined) {
    const form = new FormData();
    form.set('file', new File([text], 'projekt.txt'));
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
    reply = JSON.stringify({ cards: [{ front: 'F', back: 'B', chunkIds: ['c9'] }] });

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
