import { type NotebookOverview, SOURCE_KIND, SOURCE_STATUS, type SourceStatus } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { findNotebookForOverview, saveNotebookOverview } from './notebook-overview-repository';
import { findNotebook, listNotebooks } from './notebook-repository';
import { notebooks, notebookSources, sources } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'nb-overview-user-a';
const OTHER_USER = 'nb-overview-user-b';
const OVERVIEW: NotebookOverview = {
  emoji: '🔬',
  summary: 'Die Quellen beschreiben **Polarlicht**.',
};
const KEY = 'a'.repeat(64);

async function insertNotebook(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'N' }).returning();
  if (!notebook) throw new Error('insert returned no row');
  return notebook;
}

let counter = 0;
/** A source of the user, linked to the notebook. `addedAt` orders the sources of a notebook. */
async function addSource(
  userId: string,
  notebookId: string,
  options: { title: string; status?: SourceStatus; text?: string | null; addedAt: string }
) {
  counter += 1;
  const [source] = await db
    .insert(sources)
    .values({
      userId,
      contentHash: `${userId}-${counter}`,
      kind: SOURCE_KIND.TXT,
      title: options.title,
      status: options.status ?? SOURCE_STATUS.READY,
      canonicalText: options.text === undefined ? `Text von ${options.title}.` : options.text,
    })
    .returning();
  if (!source) throw new Error('insert returned no row');
  await db
    .insert(notebookSources)
    .values({ notebookId, sourceId: source.id, addedAt: new Date(options.addedAt) });
  return source;
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER, OTHER_USER]);
});

afterAll(async () => {
  await pool.end();
});

describe('the sources an overview is made from', () => {
  it('lists the ready sources with their text, in the order they were added', async () => {
    const notebook = await insertNotebook(USER);
    const second = await addSource(USER, notebook.id, {
      title: 'zweite.txt',
      addedAt: '2026-10-01T10:02:00Z',
    });
    const first = await addSource(USER, notebook.id, {
      title: 'erste.txt',
      addedAt: '2026-10-01T10:01:00Z',
    });

    const found = await findNotebookForOverview(db, USER, notebook.id);

    expect(found?.sources).toEqual([
      { id: first.id, title: 'erste.txt', text: 'Text von erste.txt.' },
      { id: second.id, title: 'zweite.txt', text: 'Text von zweite.txt.' },
    ]);
    expect(found?.stored).toBeNull();
  });

  it('leaves out sources that are not ready or have no text', async () => {
    const notebook = await insertNotebook(USER);
    const ready = await addSource(USER, notebook.id, {
      title: 'fertig.txt',
      addedAt: '2026-10-01T10:01:00Z',
    });
    await addSource(USER, notebook.id, {
      title: 'wartet.txt',
      status: SOURCE_STATUS.PENDING,
      addedAt: '2026-10-01T10:02:00Z',
    });
    await addSource(USER, notebook.id, {
      title: 'liest.txt',
      status: SOURCE_STATUS.PROCESSING,
      addedAt: '2026-10-01T10:03:00Z',
    });
    await addSource(USER, notebook.id, {
      title: 'kaputt.txt',
      status: SOURCE_STATUS.FAILED,
      addedAt: '2026-10-01T10:04:00Z',
    });
    await addSource(USER, notebook.id, {
      title: 'leer.txt',
      text: null,
      addedAt: '2026-10-01T10:05:00Z',
    });

    const found = await findNotebookForOverview(db, USER, notebook.id);

    expect(found?.sources.map((source) => source.id)).toEqual([ready.id]);
  });

  it('counts a source that is not selected: the overview covers the whole notebook', async () => {
    const notebook = await insertNotebook(USER);
    const source = await addSource(USER, notebook.id, {
      title: 'q.txt',
      addedAt: '2026-10-01T10:01:00Z',
    });
    await db
      .update(notebookSources)
      .set({ selected: false })
      .where(eq(notebookSources.sourceId, source.id));

    const found = await findNotebookForOverview(db, USER, notebook.id);

    expect(found?.sources).toHaveLength(1);
  });

  it('finds nothing in the notebook of another user, in an unknown one or with a bad ID', async () => {
    const notebook = await insertNotebook(USER);
    await addSource(USER, notebook.id, { title: 'q.txt', addedAt: '2026-10-01T10:01:00Z' });

    expect(await findNotebookForOverview(db, OTHER_USER, notebook.id)).toBeNull();
    expect(
      await findNotebookForOverview(db, USER, '00000000-0000-4000-8000-000000000000')
    ).toBeNull();
    expect(await findNotebookForOverview(db, USER, 'kein-uuid')).toBeNull();
  });

  it('reports the own summary of the notebook', async () => {
    const notebook = await insertNotebook(USER);
    await db
      .update(notebooks)
      .set({ customSummary: 'Mein Text' })
      .where(eq(notebooks.id, notebook.id));

    expect((await findNotebookForOverview(db, USER, notebook.id))?.customSummary).toBe('Mein Text');
  });

  it('gives an empty list for a notebook without sources', async () => {
    const notebook = await insertNotebook(USER);

    expect(await findNotebookForOverview(db, USER, notebook.id)).toEqual({
      sources: [],
      stored: null,
      customSummary: null,
    });
  });
});

describe('the stored overview', () => {
  it('keeps the overview with the key of the sources it was made from', async () => {
    const notebook = await insertNotebook(USER);

    await saveNotebookOverview(db, USER, notebook.id, OVERVIEW, KEY);

    expect((await findNotebookForOverview(db, USER, notebook.id))?.stored).toEqual({
      overview: OVERVIEW,
      key: KEY,
    });
  });

  it('replaces the overview when it is made again', async () => {
    const notebook = await insertNotebook(USER);
    await saveNotebookOverview(db, USER, notebook.id, OVERVIEW, KEY);
    const newer = { emoji: '🧠', summary: 'Neu.' };

    await saveNotebookOverview(db, USER, notebook.id, newer, 'b'.repeat(64));

    expect((await findNotebookForOverview(db, USER, notebook.id))?.stored).toEqual({
      overview: newer,
      key: 'b'.repeat(64),
    });
  });

  it('never writes into the notebook of another user', async () => {
    const notebook = await insertNotebook(USER);

    await saveNotebookOverview(db, OTHER_USER, notebook.id, OVERVIEW, KEY);

    expect((await findNotebookForOverview(db, USER, notebook.id))?.stored).toBeNull();
  });

  it('throws for a stored value that does not fit the contract, instead of showing it', async () => {
    const notebook = await insertNotebook(USER);
    await db
      .update(notebooks)
      .set({ overview: { emoji: 'kein Emoji', summary: 'x' }, overviewKey: KEY })
      .where(eq(notebooks.id, notebook.id));

    await expect(findNotebookForOverview(db, USER, notebook.id)).rejects.toThrow();
  });
});

describe('the symbol on the notebook', () => {
  it('is null until the overview exists, then the one the overview chose', async () => {
    const notebook = await insertNotebook(USER);

    expect((await findNotebook(db, USER, notebook.id))?.emoji).toBeNull();
    expect((await listNotebooks(db, USER)).map((item) => item.emoji)).toEqual([null]);

    await saveNotebookOverview(db, USER, notebook.id, OVERVIEW, KEY);

    expect((await findNotebook(db, USER, notebook.id))?.emoji).toBe('🔬');
    expect((await listNotebooks(db, USER)).map((item) => item.emoji)).toEqual(['🔬']);
  });
});
