import {
  API_ERROR,
  ApiErrorSchema,
  HealthSchema,
  NotebookListSchema,
  NotebookSchema,
  SOURCE_KIND,
  SOURCE_STATUS,
  SourceListSchema,
  SUBMIT_ACTION,
  SubmitSourceResultSchema,
} from '@nlm/shared';
import { PDFDocument } from 'pdf-lib';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { LIMITS } from './config/limits';
import { type FetchDeps, PDF_CONTENT_TYPE } from './import/fetch-url';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const PUBLIC_ADDRESS = '93.184.216.34';

const network: FetchDeps = {
  lookup: async () => [PUBLIC_ADDRESS],
  request: async () =>
    new Response(
      `<html><head><title>Ein Artikel</title></head><body><article><h1>Ein Artikel</h1><p>${'Genug Text für die Erkennung. '.repeat(30)}</p></article></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } }
    ),
};

const harness = createHarness({ fetch: network });
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

const json = (cookie: string, body: unknown, method = 'POST') => ({
  method,
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function upload(
  cookie: string,
  name: string,
  content: string | Uint8Array,
  type = 'application/octet-stream'
) {
  const form = new FormData();
  form.set('file', new File([content], name, { type }));
  return { method: 'POST', headers: { cookie }, body: form };
}

async function createNotebook(cookie: string, title = 'Notizbuch'): Promise<string> {
  const response = await app.request('/api/notebooks', json(cookie, { title }));
  return NotebookSchema.parse(await response.json()).id;
}

async function pdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) doc.addPage();
  return doc.save();
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

describe('health and authentication', () => {
  it('answers the health check without a session', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(HealthSchema.safeParse(await response.json()).success).toBe(true);
  });

  it('fails the health check when the database cannot be reached', async () => {
    const down = createHarness();
    await down.pool.end();

    const response = await createApp(down.deps).request('/health');

    expect(response.status).toBe(500);
  });

  it.each(['/api/notebooks', '/api/notebooks/abc/sources'])('protects %s', async (path) => {
    const response = await app.request(path);

    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.UNAUTHENTICATED);
  });
});

describe('notebooks', () => {
  it('creates a notebook and lists only the own ones', async () => {
    await createNotebook(alice, 'Alices');
    await createNotebook(bob, 'Bobs');

    const response = await app.request('/api/notebooks', { headers: { cookie: alice } });

    expect(response.status).toBe(200);
    const list = NotebookListSchema.parse(await response.json());
    expect(list.map((n) => n.title)).toEqual(['Alices']);
  });

  it('answers 400 with the shared error shape for an empty title', async () => {
    const response = await app.request('/api/notebooks', json(alice, { title: '   ' }));

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.INVALID_REQUEST);
  });

  it('renames an own notebook and refuses an empty title', async () => {
    const own = await createNotebook(alice, 'Alt');

    const renamed = await app.request(`/api/notebooks/${own}`, {
      method: 'PATCH',
      headers: { cookie: alice, 'content-type': 'application/json' },
      body: JSON.stringify({ title: ' Neu ' }),
    });
    const empty = await app.request(`/api/notebooks/${own}`, {
      method: 'PATCH',
      headers: { cookie: alice, 'content-type': 'application/json' },
      body: JSON.stringify({ title: '  ' }),
    });

    expect(renamed.status).toBe(200);
    expect(NotebookSchema.parse(await renamed.json())).toMatchObject({ id: own, title: 'Neu' });
    expect(empty.status).toBe(400);
  });

  it("does not rename another user's notebook", async () => {
    const bobs = await createNotebook(bob, 'Bobs');

    const response = await app.request(`/api/notebooks/${bobs}`, {
      method: 'PATCH',
      headers: { cookie: alice, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Meins' }),
    });

    expect(response.status).toBe(404);
    const list = await app.request('/api/notebooks', { headers: { cookie: bob } });
    expect(NotebookListSchema.parse(await list.json())[0]?.title).toBe('Bobs');
  });

  it('deletes an own notebook and answers 404 for the same one afterwards', async () => {
    const own = await createNotebook(alice, 'Weg damit');

    const first = await app.request(`/api/notebooks/${own}`, {
      method: 'DELETE',
      headers: { cookie: alice },
    });
    const second = await app.request(`/api/notebooks/${own}`, {
      method: 'DELETE',
      headers: { cookie: alice },
    });

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });

  it("does not delete another user's notebook", async () => {
    const bobs = await createNotebook(bob);

    const response = await app.request(`/api/notebooks/${bobs}`, {
      method: 'DELETE',
      headers: { cookie: alice },
    });

    expect(response.status).toBe(404);
    const stillThere = await app.request('/api/notebooks', { headers: { cookie: bob } });
    expect(NotebookListSchema.parse(await stillThere.json())).toHaveLength(1);
  });

  it('copies a notebook for its owner, and refuses to copy the notebook of somebody else', async () => {
    const mine = await createNotebook(alice, 'Forschung');
    const bobs = await createNotebook(bob, 'Bobs');

    const copied = await app.request(`/api/notebooks/${mine}/copy`, {
      method: 'POST',
      headers: { cookie: alice },
    });
    const refused = await app.request(`/api/notebooks/${bobs}/copy`, {
      method: 'POST',
      headers: { cookie: alice },
    });

    expect(copied.status).toBe(201);
    expect(NotebookSchema.parse(await copied.json()).title).toBe('Kopie von Forschung');
    expect(refused.status).toBe(404);
    const list = NotebookListSchema.parse(
      await (await app.request('/api/notebooks', { headers: { cookie: alice } })).json()
    );
    expect(list).toHaveLength(2);
  });

  it("answers 404 for another user's notebook", async () => {
    const bobs = await createNotebook(bob);

    const response = await app.request(`/api/notebooks/${bobs}/sources`, {
      headers: { cookie: alice },
    });

    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.NOT_FOUND);
  });
});

describe('file upload', () => {
  it('accepts a text file, queues one job and lists it as pending', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'notiz.txt', 'Inhalt der Notiz')
    );

    expect(response.status).toBe(202);
    const result = SubmitSourceResultSchema.parse(await response.json());
    expect(result.action).toBe(SUBMIT_ACTION.CREATED);
    expect(harness.enqueued).toEqual([result.sourceId]);

    const list = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: result.sourceId,
      title: 'notiz.txt',
      kind: SOURCE_KIND.TXT,
      status: SOURCE_STATUS.PENDING,
      selected: true,
    });
  });

  it('recognizes content the user already has and does not queue it again', async () => {
    const notebook = await createNotebook(alice);
    await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'a.txt', 'gleicher Inhalt')
    );
    harness.enqueued.length = 0;

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'anders-benannt.txt', 'gleicher Inhalt')
    );

    expect(SubmitSourceResultSchema.parse(await response.json()).action).toBe(SUBMIT_ACTION.REUSED);
    expect(harness.enqueued).toEqual([]);
  });

  it('adds known content to a second notebook without processing it again', async () => {
    const first = await createNotebook(alice, 'Eins');
    const second = await createNotebook(alice, 'Zwei');
    await app.request(
      `/api/notebooks/${first}/sources/file`,
      upload(alice, 'a.txt', 'geteilter Inhalt')
    );
    harness.enqueued.length = 0;

    await app.request(
      `/api/notebooks/${second}/sources/file`,
      upload(alice, 'a.txt', 'geteilter Inhalt')
    );

    const list = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${second}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(list).toHaveLength(1);
    expect(harness.enqueued).toEqual([]);
  });

  it('does not share content between users', async () => {
    const aliceBook = await createNotebook(alice);
    const bobBook = await createNotebook(bob);
    await app.request(
      `/api/notebooks/${aliceBook}/sources/file`,
      upload(alice, 'a.txt', 'derselbe Text')
    );

    const response = await app.request(
      `/api/notebooks/${bobBook}/sources/file`,
      upload(bob, 'a.txt', 'derselbe Text')
    );

    expect(SubmitSourceResultSchema.parse(await response.json()).action).toBe(
      SUBMIT_ACTION.CREATED
    );
  });

  it('accepts a valid PDF', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'bericht.pdf', await pdf(2), 'application/pdf')
    );

    expect(response.status).toBe(202);
  });

  it('accepts a photo or scan as an image source and queues it', async () => {
    const notebook = await createNotebook(alice);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'quittung.png', png, 'image/png')
    );

    expect(response.status).toBe(202);
    const list = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(list[0]).toMatchObject({ title: 'quittung.png', kind: SOURCE_KIND.IMAGE });
    expect(harness.enqueued).toHaveLength(1);
  });

  it('rejects a PDF with too many pages before it costs anything', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'riesig.pdf', await pdf(LIMITS.UPLOAD_MAX_PDF_PAGES + 1))
    );

    expect(response.status).toBe(422);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.TOO_MANY_PAGES);
    expect(harness.enqueued).toEqual([]);
  });

  it('rejects a file that is too large', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'gross.txt', new Uint8Array(LIMITS.UPLOAD_MAX_BYTES + 1).fill(97))
    );

    expect(response.status).toBe(413);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.FILE_TOO_LARGE);
  });

  it('rejects an unsupported file type and a renamed file', async () => {
    const notebook = await createNotebook(alice);

    const image = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'bild.png', 'x')
    );
    const fake = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'falsch.pdf', 'kein pdf')
    );

    for (const response of [image, fake]) {
      expect(response.status).toBe(415);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.UNSUPPORTED_FILE);
    }
  });

  it('rejects a request without a file', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(`/api/notebooks/${notebook}/sources/file`, {
      method: 'POST',
      headers: { cookie: alice },
      body: new FormData(),
    });

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.INVALID_REQUEST);
  });

  it("does not accept an upload into another user's notebook", async () => {
    const bobs = await createNotebook(bob);

    const response = await app.request(
      `/api/notebooks/${bobs}/sources/file`,
      upload(alice, 'a.txt', 'x')
    );

    expect(response.status).toBe(404);
    expect(harness.enqueued).toEqual([]);
  });

  it('stops new sources when the quota is used up but still recognizes known content', async () => {
    const notebook = await createNotebook(alice);
    for (let index = 0; index < LIMITS.SOURCES_PER_USER_PER_WINDOW; index += 1) {
      await app.request(
        `/api/notebooks/${notebook}/sources/file`,
        upload(alice, `n${index}.txt`, `Inhalt ${index}`)
      );
    }

    const fresh = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'neu.txt', 'ganz neu')
    );
    const known = await app.request(
      `/api/notebooks/${notebook}/sources/file`,
      upload(alice, 'x.txt', 'Inhalt 0')
    );

    expect(fresh.status).toBe(429);
    expect(ApiErrorSchema.parse(await fresh.json()).code).toBe(API_ERROR.UPLOAD_LIMIT_REACHED);
    expect(known.status).toBe(202);
  });
});

describe('URL import', () => {
  it('imports a public page and titles the source with the page title', async () => {
    const notebook = await createNotebook(alice);

    const response = await app.request(
      `/api/notebooks/${notebook}/sources/url`,
      json(alice, { url: 'https://example.com/artikel' })
    );

    expect(response.status).toBe(202);
    const list = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(list[0]).toMatchObject({ title: 'Ein Artikel', kind: SOURCE_KIND.URL });
    expect(harness.enqueued).toHaveLength(1);
  });

  it.each(['http://127.0.0.1/admin', 'http://localhost/', 'ftp://example.com/x'])(
    'refuses %s',
    async (url) => {
      const notebook = await createNotebook(alice);

      const response = await app.request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url })
      );

      expect([400]).toContain(response.status);
      expect(harness.enqueued).toEqual([]);
    }
  );

  describe('a link to a PDF', () => {
    const answering = (body: Uint8Array | string, type = PDF_CONTENT_TYPE) =>
      createApp({
        ...harness.deps,
        fetch: {
          lookup: async () => [PUBLIC_ADDRESS],
          request: async () =>
            new Response(body, { status: 200, headers: { 'content-type': type } }),
        },
      });

    it('is read like an uploaded PDF and named after the file in the address', async () => {
      const notebook = await createNotebook(alice);

      const response = await answering(await pdf(2)).request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url: 'https://example.com/berichte/jahresbericht%202025.pdf?download=1' })
      );

      expect(response.status).toBe(202);
      const list = SourceListSchema.parse(
        await (
          await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
        ).json()
      );
      expect(list[0]).toMatchObject({ title: 'jahresbericht 2025.pdf', kind: SOURCE_KIND.PDF });
      expect(harness.enqueued).toHaveLength(1);
    });

    it('keeps the file name as written when the address has a broken escape', async () => {
      const notebook = await createNotebook(alice);

      await answering(await pdf(1)).request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url: 'https://example.com/kaputt%E0%A4%A.pdf' })
      );

      const list = SourceListSchema.parse(
        await (
          await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
        ).json()
      );
      expect(list[0]).toMatchObject({ title: 'kaputt%E0%A4%A.pdf', kind: SOURCE_KIND.PDF });
    });

    it('is named after the host when the address names no file', async () => {
      const notebook = await createNotebook(alice);

      await answering(await pdf(1)).request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url: 'https://example.com/download?id=7' })
      );

      const list = SourceListSchema.parse(
        await (
          await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
        ).json()
      );
      expect(list[0]).toMatchObject({ title: 'example.com', kind: SOURCE_KIND.PDF });
    });

    it('is refused when it has too many pages, like an upload', async () => {
      const notebook = await createNotebook(alice);

      const response = await answering(await pdf(LIMITS.UPLOAD_MAX_PDF_PAGES + 1)).request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url: 'https://example.com/lang.pdf' })
      );

      expect(response.status).toBe(422);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.TOO_MANY_PAGES);
      expect(harness.enqueued).toEqual([]);
    });

    it('is refused when the answer only claims to be a PDF', async () => {
      const notebook = await createNotebook(alice);

      const response = await answering('<html>kein PDF</html>').request(
        `/api/notebooks/${notebook}/sources/url`,
        json(alice, { url: 'https://example.com/falsch.pdf' })
      );

      expect(response.status).toBe(415);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.UNSUPPORTED_FILE);
      expect(harness.enqueued).toEqual([]);
    });
  });

  it('refuses a host that resolves to a private address with the shared URL error', async () => {
    const notebook = await createNotebook(alice);
    const guarded = createApp({
      ...harness.deps,
      fetch: { lookup: async () => ['10.0.0.5'], request: network.request },
    });

    const response = await guarded.request(
      `/api/notebooks/${notebook}/sources/url`,
      json(alice, { url: 'https://intern.example.com' })
    );

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.INVALID_URL);
  });
});

describe('selection and removal', () => {
  it('changes the selection and removes a source from the notebook', async () => {
    const notebook = await createNotebook(alice);
    const added = SubmitSourceResultSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${notebook}/sources/file`,
          upload(alice, 'a.txt', 'Inhalt')
        )
      ).json()
    );

    const patched = await app.request(
      `/api/notebooks/${notebook}/sources/${added.sourceId}`,
      json(alice, { selected: false }, 'PATCH')
    );
    expect(patched.status).toBe(200);
    const listed = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(listed[0]?.selected).toBe(false);

    const removed = await app.request(`/api/notebooks/${notebook}/sources/${added.sourceId}`, {
      method: 'DELETE',
      headers: { cookie: alice },
    });
    expect(removed.status).toBe(204);
    const after = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(after).toEqual([]);
  });

  it('renames a source and refuses an empty title', async () => {
    const notebook = await createNotebook(alice);
    const added = SubmitSourceResultSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${notebook}/sources/file`,
          upload(alice, 'alt.txt', 'Inhalt zum Umbenennen')
        )
      ).json()
    );
    const url = `/api/notebooks/${notebook}/sources/${added.sourceId}/title`;

    const renamed = await app.request(url, json(alice, { title: ' Neu ' }, 'PATCH'));
    const empty = await app.request(url, json(alice, { title: '  ' }, 'PATCH'));

    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toEqual({ title: 'Neu' });
    expect(empty.status).toBe(400);
    const listed = SourceListSchema.parse(
      await (
        await app.request(`/api/notebooks/${notebook}/sources`, { headers: { cookie: alice } })
      ).json()
    );
    expect(listed[0]?.title).toBe('Neu');
  });

  it("answers 404 when renaming another user's source", async () => {
    const bobsBook = await createNotebook(bob);
    const added = SubmitSourceResultSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${bobsBook}/sources/file`,
          upload(bob, 'b.txt', 'Bobs Inhalt zum Umbenennen')
        )
      ).json()
    );

    const response = await app.request(
      `/api/notebooks/${bobsBook}/sources/${added.sourceId}/title`,
      json(alice, { title: 'Meins' }, 'PATCH')
    );

    expect(response.status).toBe(404);
  });

  it("answers 404 when changing or removing another user's source", async () => {
    const bobsBook = await createNotebook(bob);
    const added = SubmitSourceResultSchema.parse(
      await (
        await app.request(
          `/api/notebooks/${bobsBook}/sources/file`,
          upload(bob, 'a.txt', 'Bobs Inhalt')
        )
      ).json()
    );

    const patched = await app.request(
      `/api/notebooks/${bobsBook}/sources/${added.sourceId}`,
      json(alice, { selected: false }, 'PATCH')
    );
    const removed = await app.request(`/api/notebooks/${bobsBook}/sources/${added.sourceId}`, {
      method: 'DELETE',
      headers: { cookie: alice },
    });

    expect(patched.status).toBe(404);
    expect(removed.status).toBe(404);
  });
});
