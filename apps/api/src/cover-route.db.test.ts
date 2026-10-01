import {
  API_ERROR,
  ApiErrorSchema,
  CapabilitiesSchema,
  COVER_IMAGE,
  NotebookSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { createMemoryObjectStore } from './storage/memory-object-store';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'correct-horse-battery';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PNG_2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

const store = createMemoryObjectStore();
const harness = createHarness({ objectStore: store });
const app = createApp(harness.deps);
const plain = createHarness();
const plainApp = createApp(plain.deps);

async function signUp(h: ReturnType<typeof createHarness>, email: string) {
  const response = await h.auth.handler(
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

async function createNotebook(cookie: string, a = app): Promise<string> {
  const response = await a.request('/api/notebooks', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'N' }),
  });
  return NotebookSchema.parse(await response.json()).id;
}

const upload = (cookie: string, bytes: Uint8Array, name = 'bild.png', type = 'image/png') => {
  const form = new FormData();
  form.set('file', new File([bytes], name, { type }));
  return { method: 'PUT', headers: { cookie }, body: form };
};
const cover = (id: string) => `/api/notebooks/${id}/cover`;

let alice: string;
let bob: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  await store.removePrefix('');
  alice = await signUp(harness, 'alice@example.test');
  bob = await signUp(harness, 'bob@example.test');
});

afterAll(async () => {
  await harness.pool.end();
  await plain.pool.end();
});

describe('the cover image of a notebook', () => {
  it('stores an image and hands it out with the type found in its bytes', async () => {
    const id = await createNotebook(alice);

    const response = await app.request(cover(id), upload(alice, PNG));

    expect(response.status).toBe(200);
    const notebook = NotebookSchema.parse(await response.json());
    expect(notebook.coverVersion).not.toBeNull();
    const image = await app.request(cover(id), { headers: { cookie: alice } });
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(image.headers.get('cache-control')).toMatch(/private/);
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...PNG]);
  });

  it('refuses a file that only claims to be an image, and one that is too large', async () => {
    const id = await createNotebook(alice);
    const html = new TextEncoder().encode('<script>alert(1)</script>');
    const huge = new Uint8Array(COVER_IMAGE.MAX_BYTES + 1);
    huge.set(PNG);

    const disguised = await app.request(cover(id), upload(alice, html, 'bild.png', 'image/png'));
    const large = await app.request(cover(id), upload(alice, huge));
    const empty = await app.request(cover(id), { method: 'PUT', headers: { cookie: alice } });

    for (const refused of [disguised, large, empty]) {
      expect(refused.status).toBe(400);
      expect(ApiErrorSchema.parse(await refused.json()).code).toBe(API_ERROR.COVER_INVALID);
    }
    expect(store.keys()).toEqual([]);
  });

  it('replaces the image and removes the old file', async () => {
    const id = await createNotebook(alice);
    await app.request(cover(id), upload(alice, PNG));
    const first = store.keys();

    await app.request(cover(id), upload(alice, PNG_2));

    expect(store.keys()).toHaveLength(1);
    expect(store.keys()).not.toEqual(first);
    const image = await app.request(cover(id), { headers: { cookie: alice } });
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([...PNG_2]);
  });

  it('takes the image back', async () => {
    const id = await createNotebook(alice);
    await app.request(cover(id), upload(alice, PNG));

    const removed = await app.request(cover(id), { method: 'DELETE', headers: { cookie: alice } });

    expect(removed.status).toBe(204);
    expect(store.keys()).toEqual([]);
    expect((await app.request(cover(id), { headers: { cookie: alice } })).status).toBe(404);
  });

  it('removes the file with the notebook', async () => {
    const id = await createNotebook(alice);
    await app.request(cover(id), upload(alice, PNG));

    await app.request(`/api/notebooks/${id}`, { method: 'DELETE', headers: { cookie: alice } });

    expect(store.keys()).toEqual([]);
  });

  it('refuses a body far over the limit before it reads the file', async () => {
    const id = await createNotebook(alice);
    const huge = new Uint8Array(COVER_IMAGE.MAX_BYTES * 3);
    huge.set(PNG);

    const response = await app.request(cover(id), upload(alice, huge));

    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.COVER_INVALID);
    expect(store.keys()).toEqual([]);
  });

  it('still succeeds when the old file cannot be removed from the store', async () => {
    const failing = createMemoryObjectStore();
    const remove = async () => {
      throw new Error('store down');
    };
    const tolerant = createHarness({ objectStore: { ...failing, remove } });
    const tolerantApp = createApp(tolerant.deps);
    const cookie = await signUp(tolerant, 'carol@example.test');
    const id = await createNotebook(cookie, tolerantApp);
    await tolerantApp.request(cover(id), upload(cookie, PNG));

    const replaced = await tolerantApp.request(cover(id), upload(cookie, PNG_2));
    const removed = await tolerantApp.request(cover(id), { method: 'DELETE', headers: { cookie } });
    const gone = await tolerantApp.request(`/api/notebooks/${id}`, {
      method: 'DELETE',
      headers: { cookie },
    });

    expect(replaced.status).toBe(200);
    expect(removed.status).toBe(204);
    expect(gone.status).toBe(204);
    await tolerant.pool.end();
  });

  it("is invisible and untouchable for another user's notebook", async () => {
    const id = await createNotebook(alice);
    await app.request(cover(id), upload(alice, PNG));

    const read = await app.request(cover(id), { headers: { cookie: bob } });
    const write = await app.request(cover(id), upload(bob, PNG_2));
    const remove = await app.request(cover(id), { method: 'DELETE', headers: { cookie: bob } });

    expect([read.status, write.status, remove.status]).toEqual([404, 404, 404]);
    expect(store.keys()).toHaveLength(1);
    expect(store.keys()[0]).toContain(`/${id}/`);
  });

  it('needs a signed-in user', async () => {
    const id = await createNotebook(alice);

    expect((await app.request(cover(id))).status).toBe(401);
    expect((await app.request(cover(id), { method: 'PUT' })).status).toBe(401);
  });

  it('is not offered where there is no object store', async () => {
    const cookie = await signUp(plain, 'carla@example.test');
    const id = await createNotebook(cookie, plainApp);

    const put = await plainApp.request(cover(id), upload(cookie, PNG));
    const caps = await plainApp.request('/api/capabilities', { headers: { cookie } });

    expect(put.status).toBe(503);
    expect(ApiErrorSchema.parse(await put.json()).code).toBe(API_ERROR.COVER_UNAVAILABLE);
    expect(CapabilitiesSchema.parse(await caps.json()).coverImage).toBe(false);
    await plain.pool.query('TRUNCATE "user" CASCADE');
  });

  it('says it is set up where there is an object store', async () => {
    const caps = await app.request('/api/capabilities', { headers: { cookie: alice } });

    expect(CapabilitiesSchema.parse(await caps.json()).coverImage).toBe(true);
  });

  it('does not copy the cover image to a copy of the notebook', async () => {
    const id = await createNotebook(alice);
    await app.request(cover(id), upload(alice, PNG));

    const copy = await app.request(`/api/notebooks/${id}/copy`, {
      method: 'POST',
      headers: { cookie: alice },
    });

    expect(NotebookSchema.parse(await copy.json()).coverVersion).toBeNull();
    expect(store.keys()).toHaveLength(1);
  });
});
