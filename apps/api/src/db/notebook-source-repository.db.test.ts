import { SOURCE_FAILURE, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  linkSource,
  listNotebookSources,
  renameSource,
  RESTART,
  restartFailedSource,
  selectedReadySourceIds,
  setReadySourcesSelected,
  setSourceSelected,
  unlinkSource,
} from './notebook-source-repository';
import { notebooks, notebookSources, sources, sourceUploads } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const OWNER = 'nsrc-owner';
const STRANGER = 'nsrc-stranger';
const TITLE = 'quelle.txt';

/** A notebook of `userId` holding one failed source whose original file is still kept. */
async function setup(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'N' }).returning();
  const [source] = await db
    .insert(sources)
    .values({
      userId,
      contentHash: `${userId}-${Math.random()}`,
      kind: SOURCE_KIND.TXT,
      title: TITLE,
      status: SOURCE_STATUS.FAILED,
      errorMessage: SOURCE_FAILURE.PARSE_FAILED,
    })
    .returning();
  if (!notebook || !source) throw new Error('insert returned no row');
  await db.insert(notebookSources).values({ notebookId: notebook.id, sourceId: source.id });
  await db.insert(sourceUploads).values({ sourceId: source.id, bytes: Buffer.from('x') });
  return { notebook, source };
}

async function stored(sourceId: string) {
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  const links = await db
    .select()
    .from(notebookSources)
    .where(eq(notebookSources.sourceId, sourceId));
  return { source, links };
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [OWNER, STRANGER]);
});

afterAll(async () => {
  await pool.end();
});

describe('notebook source repository isolation', () => {
  it('shows a stranger nothing of the owner’s sources', async () => {
    const { notebook } = await setup(OWNER);

    expect(await listNotebookSources(db, STRANGER, notebook.id)).toEqual([]);
    expect(await listNotebookSources(db, OWNER, notebook.id)).toHaveLength(1);
  });

  it('lets a stranger change nothing in the owner’s notebook', async () => {
    const { notebook, source } = await setup(OWNER);
    const before = await stored(source.id);

    expect(await setSourceSelected(db, STRANGER, notebook.id, source.id, false)).toBe(false);
    expect(await setReadySourcesSelected(db, STRANGER, notebook.id, false)).toBe(false);
    expect(await renameSource(db, STRANGER, notebook.id, source.id, 'fremd')).toBe(false);
    expect(await restartFailedSource(db, STRANGER, notebook.id, source.id)).toBe(RESTART.MISSING);
    expect(await unlinkSource(db, STRANGER, notebook.id, source.id)).toBe(false);

    expect(await stored(source.id)).toEqual(before);
    expect((await stored(source.id)).source?.title).toBe(TITLE);
  });

  it('does not link the owner’s source into a stranger’s notebook or the other way round', async () => {
    const owner = await setup(OWNER);
    const stranger = await setup(STRANGER);

    expect(await linkSource(db, STRANGER, stranger.notebook.id, owner.source.id)).toBe(false);
    expect(await linkSource(db, STRANGER, owner.notebook.id, stranger.source.id)).toBe(false);
    expect(await linkSource(db, OWNER, stranger.notebook.id, owner.source.id)).toBe(false);

    expect((await stored(owner.source.id)).links).toHaveLength(1);
    expect((await stored(stranger.source.id)).links).toHaveLength(1);
  });

  it('keeps a source out of the selection of a notebook it is not linked to', async () => {
    const owner = await setup(OWNER);
    await db
      .update(sources)
      .set({ status: SOURCE_STATUS.READY })
      .where(eq(sources.id, owner.source.id));

    expect(await selectedReadySourceIds(db, STRANGER, owner.notebook.id)).toEqual([]);
    expect(await selectedReadySourceIds(db, OWNER, owner.notebook.id)).toEqual([owner.source.id]);
  });

  it('leaves a foreign source alone when the bulk selection runs, even if a link to it exists', async () => {
    const owner = await setup(OWNER);
    const stranger = await setup(STRANGER);
    await db
      .update(sources)
      .set({ status: SOURCE_STATUS.READY })
      .where(eq(sources.id, stranger.source.id));
    await db
      .insert(notebookSources)
      .values({ notebookId: owner.notebook.id, sourceId: stranger.source.id });

    expect(await setReadySourcesSelected(db, OWNER, owner.notebook.id, false)).toBe(true);

    const [link] = await db
      .select()
      .from(notebookSources)
      .where(
        and(
          eq(notebookSources.notebookId, owner.notebook.id),
          eq(notebookSources.sourceId, stranger.source.id)
        )
      );
    expect(link?.selected).toBe(true);
  });

  it('works for the owner, so the refusals above are not an empty setup', async () => {
    const { notebook, source } = await setup(OWNER);

    expect(await restartFailedSource(db, OWNER, notebook.id, source.id)).toBe(RESTART.STARTED);
    expect(await renameSource(db, OWNER, notebook.id, source.id, 'neu')).toBe(true);
    expect(await unlinkSource(db, OWNER, notebook.id, source.id)).toBe(true);
  });
});
