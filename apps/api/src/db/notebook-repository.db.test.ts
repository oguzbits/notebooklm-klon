import { CHAT_ROLE, SOURCE_FAILURE, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  countSourcesSince,
  createNotebook,
  deleteNotebook,
  findNotebook,
  linkSource,
  listNotebooks,
  listNotebookSources,
  renameSource,
  selectedReadySourceIds,
  setSourceSelected,
  unlinkSource,
  updateNotebook,
} from './notebook-repository';
import { sources } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'user-a';
const OTHER = 'user-b';

async function addSource(
  userId: string,
  hash: string,
  values: Partial<typeof sources.$inferInsert> = {}
) {
  const [row] = await db
    .insert(sources)
    .values({ userId, contentHash: hash, kind: SOURCE_KIND.PDF, title: hash, ...values })
    .returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

beforeEach(async () => {
  await pool.query('TRUNCATE sources, notebooks CASCADE');
  await ensureUsers(pool, [USER, OTHER]);
});

afterAll(async () => {
  await pool.end();
});

describe('notebooks', () => {
  it('creates a notebook for the user and lists only their own, newest first', async () => {
    const first = await createNotebook(db, USER, 'Erstes');
    const second = await createNotebook(db, USER, 'Zweites');
    await createNotebook(db, OTHER, 'Fremdes');

    const listed = await listNotebooks(db, USER);

    expect(listed.map((n) => n.id)).toEqual([second.id, first.id]);
    expect(listed[0]).toMatchObject({ title: 'Zweites' });
    expect(typeof listed[0]?.createdAt).toBe('string');
  });

  it("does not find another user's notebook", async () => {
    const theirs = await createNotebook(db, OTHER, 'Fremdes');

    expect(await findNotebook(db, USER, theirs.id)).toBeNull();
    expect(await findNotebook(db, OTHER, theirs.id)).toMatchObject({ id: theirs.id });
  });

  it('returns null for an ID that is not a UUID instead of failing', async () => {
    expect(await findNotebook(db, USER, 'kein-uuid')).toBeNull();
  });
});

describe('sources of a notebook', () => {
  it('lists linked sources with status, failure and selection, oldest first', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const ready = await addSource(USER, 'a', { status: SOURCE_STATUS.READY, pageCount: 4 });
    const failed = await addSource(USER, 'b', {
      status: SOURCE_STATUS.FAILED,
      errorMessage: SOURCE_FAILURE.EMPTY_TEXT,
    });
    await linkSource(db, USER, notebook.id, ready.id);
    await linkSource(db, USER, notebook.id, failed.id);

    const listed = await listNotebookSources(db, USER, notebook.id);

    expect(listed).toHaveLength(2);
    expect(listed[0]).toMatchObject({
      id: ready.id,
      status: SOURCE_STATUS.READY,
      failure: null,
      pageCount: 4,
      selected: true,
    });
    expect(listed[1]).toMatchObject({
      id: failed.id,
      status: SOURCE_STATUS.FAILED,
      failure: SOURCE_FAILURE.EMPTY_TEXT,
    });
  });

  it("lists nothing for another user's notebook", async () => {
    const theirs = await createNotebook(db, OTHER, 'Fremdes');
    const source = await addSource(OTHER, 'x');
    await linkSource(db, OTHER, theirs.id, source.id);

    expect(await listNotebookSources(db, USER, theirs.id)).toEqual([]);
  });

  it('links a source once and reports whether anything was linked', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const source = await addSource(USER, 'a');

    expect(await linkSource(db, USER, notebook.id, source.id)).toBe(true);
    expect(await linkSource(db, USER, notebook.id, source.id)).toBe(true);
    expect(await listNotebookSources(db, USER, notebook.id)).toHaveLength(1);
  });

  it("refuses to link another user's source or notebook", async () => {
    const mine = await createNotebook(db, USER, 'N');
    const theirs = await createNotebook(db, OTHER, 'F');
    const mySource = await addSource(USER, 'a');
    const theirSource = await addSource(OTHER, 'b');

    expect(await linkSource(db, USER, mine.id, theirSource.id)).toBe(false);
    expect(await linkSource(db, USER, theirs.id, mySource.id)).toBe(false);
    expect(await listNotebookSources(db, USER, mine.id)).toEqual([]);
  });

  it('changes the selection of a source in this notebook only', async () => {
    const one = await createNotebook(db, USER, 'Eins');
    const two = await createNotebook(db, USER, 'Zwei');
    const source = await addSource(USER, 'a');
    await linkSource(db, USER, one.id, source.id);
    await linkSource(db, USER, two.id, source.id);

    expect(await setSourceSelected(db, USER, one.id, source.id, false)).toBe(true);

    expect((await listNotebookSources(db, USER, one.id))[0]?.selected).toBe(false);
    expect((await listNotebookSources(db, USER, two.id))[0]?.selected).toBe(true);
  });

  it('does not change or unlink what belongs to someone else', async () => {
    const theirs = await createNotebook(db, OTHER, 'F');
    const source = await addSource(OTHER, 'b');
    await linkSource(db, OTHER, theirs.id, source.id);

    expect(await setSourceSelected(db, USER, theirs.id, source.id, false)).toBe(false);
    expect(await unlinkSource(db, USER, theirs.id, source.id)).toBe(false);
    expect(await listNotebookSources(db, OTHER, theirs.id)).toHaveLength(1);
  });

  it('unlinks a source from the notebook but keeps the source itself', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const source = await addSource(USER, 'a');
    await linkSource(db, USER, notebook.id, source.id);

    expect(await unlinkSource(db, USER, notebook.id, source.id)).toBe(true);

    expect(await listNotebookSources(db, USER, notebook.id)).toEqual([]);
    expect((await pool.query('SELECT 1 FROM sources WHERE id = $1', [source.id])).rowCount).toBe(1);
  });
});

describe('deleteNotebook', () => {
  it('deletes the notebook with its links and history but keeps the sources', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const source = await addSource(USER, 'a');
    await linkSource(db, USER, notebook.id, source.id);
    await pool.query(
      'INSERT INTO chat_messages (notebook_id, user_id, role, text) VALUES ($1, $2, $3, $4)',
      [notebook.id, USER, CHAT_ROLE.USER, 'Frage']
    );

    expect(await deleteNotebook(db, USER, notebook.id)).toBe(true);

    expect(await findNotebook(db, USER, notebook.id)).toBeNull();
    expect((await pool.query('SELECT 1 FROM notebook_sources')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM chat_messages')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM sources WHERE id = $1', [source.id])).rowCount).toBe(1);
  });

  it("does not delete another user's notebook or answer for an unknown ID", async () => {
    const theirs = await createNotebook(db, OTHER, 'Fremd');

    expect(await deleteNotebook(db, USER, theirs.id)).toBe(false);
    expect(await deleteNotebook(db, USER, 'kein-uuid')).toBe(false);
    expect(await findNotebook(db, OTHER, theirs.id)).not.toBeNull();
  });
});

describe('the number of sources of a notebook', () => {
  it('is counted by the database for the list and for one notebook', async () => {
    const notebook = await createNotebook(db, USER, 'Mit Quellen');
    const empty = await createNotebook(db, USER, 'Leer');
    await linkSource(db, USER, notebook.id, (await addSource(USER, 'a')).id);
    await linkSource(db, USER, notebook.id, (await addSource(USER, 'b')).id);

    const list = await listNotebooks(db, USER);

    expect(list.find((entry) => entry.id === notebook.id)?.sourceCount).toBe(2);
    expect(list.find((entry) => entry.id === empty.id)?.sourceCount).toBe(0);
    expect((await findNotebook(db, USER, notebook.id))?.sourceCount).toBe(2);
    expect(empty.sourceCount).toBe(0);
  });

  it('does not count the sources of another notebook', async () => {
    const first = await createNotebook(db, USER, 'Eins');
    const second = await createNotebook(db, USER, 'Zwei');
    await linkSource(db, USER, first.id, (await addSource(USER, 'a')).id);

    expect((await findNotebook(db, USER, second.id))?.sourceCount).toBe(0);
  });
});

describe('updateNotebook', () => {
  it('changes the title and returns the notebook', async () => {
    const notebook = await createNotebook(db, USER, 'Alt');

    const renamed = await updateNotebook(db, USER, notebook.id, { title: 'Neu' });

    expect(renamed).toEqual({ ...notebook, title: 'Neu' });
    expect((await findNotebook(db, USER, notebook.id))?.title).toBe('Neu');
  });

  it('sets and takes back the own summary and leaves the title alone', async () => {
    const notebook = await createNotebook(db, USER, 'Titel');

    const written = await updateNotebook(db, USER, notebook.id, { customSummary: 'Mein Text' });
    expect(written).toMatchObject({ title: 'Titel', customSummary: 'Mein Text' });

    const cleared = await updateNotebook(db, USER, notebook.id, { customSummary: null });
    expect(cleared).toMatchObject({ title: 'Titel', customSummary: null });
  });

  it("does not change another user's notebook or answer for an unknown ID", async () => {
    const theirs = await createNotebook(db, OTHER, 'Fremd');

    expect(await updateNotebook(db, USER, theirs.id, { title: 'Meins' })).toBeNull();
    expect(await updateNotebook(db, USER, 'kein-uuid', { title: 'X' })).toBeNull();
    expect((await findNotebook(db, OTHER, theirs.id))?.title).toBe('Fremd');
  });
});

describe('renameSource', () => {
  it('gives a linked source of the user a new title', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const source = await addSource(USER, 'rename-a', { title: 'alt.pdf' });
    await linkSource(db, USER, notebook.id, source.id);

    expect(await renameSource(db, USER, notebook.id, source.id, 'Neu')).toBe(true);

    const [row] = await listNotebookSources(db, USER, notebook.id);
    expect(row?.title).toBe('Neu');
  });

  it('does not rename a source that is not in this notebook, belongs to another user, or is unknown', async () => {
    const mine = await createNotebook(db, USER, 'Mein');
    const theirs = await createNotebook(db, OTHER, 'Fremd');
    const unlinked = await addSource(USER, 'rename-b', { title: 'frei.pdf' });
    const theirSource = await addSource(OTHER, 'rename-c', { title: 'fremd.pdf' });
    await linkSource(db, OTHER, theirs.id, theirSource.id);

    expect(await renameSource(db, USER, mine.id, unlinked.id, 'X')).toBe(false);
    expect(await renameSource(db, USER, theirs.id, theirSource.id, 'X')).toBe(false);
    expect(await renameSource(db, USER, mine.id, 'kein-uuid', 'X')).toBe(false);
    const [row] = await listNotebookSources(db, OTHER, theirs.id);
    expect(row?.title).toBe('fremd.pdf');
  });
});

describe('countSourcesSince', () => {
  it("counts the user's own sources created within the window", async () => {
    await addSource(USER, 'a');
    await addSource(USER, 'b');
    await addSource(OTHER, 'c');
    const old = await addSource(USER, 'old');
    await pool.query("UPDATE sources SET created_at = now() - interval '3 days' WHERE id = $1", [
      old.id,
    ]);

    expect(await countSourcesSince(db, USER, 24)).toBe(2);
  });
});

describe('selectedReadySourceIds', () => {
  it('returns only sources that are ready and selected in this notebook', async () => {
    const notebook = await createNotebook(db, USER, 'N');
    const ready = await addSource(USER, 'ready', { status: SOURCE_STATUS.READY });
    const unselected = await addSource(USER, 'unselected', { status: SOURCE_STATUS.READY });
    const pending = await addSource(USER, 'pending', { status: SOURCE_STATUS.PENDING });
    const failed = await addSource(USER, 'failed', { status: SOURCE_STATUS.FAILED });
    for (const source of [ready, unselected, pending, failed]) {
      await linkSource(db, USER, notebook.id, source.id);
    }
    await setSourceSelected(db, USER, notebook.id, unselected.id, false);

    expect(await selectedReadySourceIds(db, USER, notebook.id)).toEqual([ready.id]);
  });

  it("returns nothing for another user's notebook", async () => {
    const theirs = await createNotebook(db, OTHER, 'F');
    const source = await addSource(OTHER, 'x', { status: SOURCE_STATUS.READY });
    await linkSource(db, OTHER, theirs.id, source.id);

    expect(await selectedReadySourceIds(db, USER, theirs.id)).toEqual([]);
  });

  it('does not depend on the selection in another notebook', async () => {
    const one = await createNotebook(db, USER, 'Eins');
    const two = await createNotebook(db, USER, 'Zwei');
    const source = await addSource(USER, 'a', { status: SOURCE_STATUS.READY });
    await linkSource(db, USER, one.id, source.id);
    await linkSource(db, USER, two.id, source.id);
    await setSourceSelected(db, USER, one.id, source.id, false);

    expect(await selectedReadySourceIds(db, USER, one.id)).toEqual([]);
    expect(await selectedReadySourceIds(db, USER, two.id)).toEqual([source.id]);
  });
});
