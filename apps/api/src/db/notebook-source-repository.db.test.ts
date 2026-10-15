import { SOURCE_FAILURE, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { SourceLimitReachedError } from '../core/notebook-limit';
import {
  assertRoomForSource,
  linkSource,
  renameSource,
  RESTART,
  restartFailedSource,
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

describe('source limit of a notebook', () => {
  const MAX = 2;

  /** A notebook of OWNER with `count` linked sources, plus one more unlinked source to add. */
  async function filled(count: number) {
    const { notebook } = await setup(OWNER);
    await pool.query('DELETE FROM notebook_sources');
    const made = [];
    for (let i = 0; i < count + 1; i += 1) {
      const [row] = await db
        .insert(sources)
        .values({ userId: OWNER, contentHash: `h${i}`, kind: SOURCE_KIND.TXT, title: `q${i}` })
        .returning();
      if (!row) throw new Error('insert returned no row');
      made.push(row);
    }
    for (const row of made.slice(0, count)) {
      await db.insert(notebookSources).values({ notebookId: notebook.id, sourceId: row.id });
    }
    return { notebook, linked: made.slice(0, count), extra: made[count]! };
  }

  it('links the source that reaches the limit and refuses the one after it', async () => {
    const { notebook, extra } = await filled(MAX - 1);
    const [beyond] = await db
      .insert(sources)
      .values({ userId: OWNER, contentHash: 'beyond', kind: SOURCE_KIND.TXT, title: 'b' })
      .returning();

    expect(await linkSource(db, OWNER, notebook.id, extra.id, MAX)).toBe(true);
    await expect(linkSource(db, OWNER, notebook.id, beyond!.id, MAX)).rejects.toBeInstanceOf(
      SourceLimitReachedError
    );
  });

  it('lets a source that is linked already pass at the limit', async () => {
    const { notebook, linked } = await filled(MAX);

    expect(await linkSource(db, OWNER, notebook.id, linked[0]!.id, MAX)).toBe(true);
  });

  it('does not tell a stranger about the size of a notebook that is not theirs', async () => {
    const { notebook } = await filled(MAX);
    const [theirs] = await db
      .insert(sources)
      .values({ userId: STRANGER, contentHash: 's', kind: SOURCE_KIND.TXT, title: 's' })
      .returning();

    expect(await linkSource(db, STRANGER, notebook.id, theirs!.id, MAX)).toBe(false);
    await expect(assertRoomForSource(db, STRANGER, notebook.id, MAX)).resolves.toBeUndefined();
  });

  it('waits while another link into the same notebook is in progress, so the count is not stale', async () => {
    const { notebook, extra } = await filled(MAX - 1);
    const other = await pool.connect();
    await other.query('BEGIN');
    try {
      await other.query('select pg_advisory_xact_lock(hashtext($1))', [`sources:${notebook.id}`]);
      let settled = false;
      const pending = linkSource(db, OWNER, notebook.id, extra.id, MAX).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(settled).toBe(false);

      await other.query('COMMIT');
      await expect(pending).resolves.toBe(true);
    } finally {
      other.release();
    }
  });

  it('refuses early when the notebook is full', async () => {
    const { notebook } = await filled(MAX);

    await expect(assertRoomForSource(db, OWNER, notebook.id, MAX)).rejects.toBeInstanceOf(
      SourceLimitReachedError
    );
  });
});
