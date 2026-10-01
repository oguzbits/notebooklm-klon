import { EMBEDDING_DIMENSIONS, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { notebookOverviewKey } from '../core/notebook-overview-prompt';
import { user } from './auth-schema';
import {
  copyNotebookToUser,
  countGuests,
  deleteExpiredGuests,
  findDemoTemplate,
} from './guest-repository';
import { findNotebookForOverview } from './notebook-overview-repository';
import { chunks, notebooks, notebookSources, sources } from './schema';
import { axisVector, createTestDb } from './testing/test-db';

const { db, pool } = createTestDb();
const OWNER_EMAIL = 'demo@example.test';
const TITLE = 'Beispiel: Projekt Nordlicht';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

async function makeUser(id: string, options: { email?: string; guest?: boolean; ageMs?: number }) {
  await db.insert(user).values({
    id,
    name: id,
    email: options.email ?? `${id}@example.test`,
    isAnonymous: options.guest ?? false,
    createdAt: new Date(Date.now() - (options.ageMs ?? 0)),
  });
}

/** The example notebook: two ready sources with chunks, one failed source, a stored overview. */
async function makeTemplate() {
  await makeUser('owner', { email: OWNER_EMAIL });
  const [notebook] = await db
    .insert(notebooks)
    .values({
      userId: 'owner',
      title: TITLE,
      overview: { emoji: '🔬', summary: 'Es geht um **Nordlicht**.' },
      overviewKey: 'old-key',
    })
    .returning({ id: notebooks.id });
  if (!notebook) throw new Error('no notebook');
  const made = async (
    title: string,
    status: typeof SOURCE_STATUS.READY | typeof SOURCE_STATUS.FAILED
  ) => {
    const [source] = await db
      .insert(sources)
      .values({
        userId: 'owner',
        contentHash: `hash-${title}`,
        kind: SOURCE_KIND.MD,
        title,
        status,
        canonicalText: status === SOURCE_STATUS.READY ? `Text von ${title}.` : null,
        overview: { summary: 'Kurz.', keyTopics: ['A'], suggestedQuestions: ['Was?'] },
      })
      .returning({ id: sources.id });
    if (!source) throw new Error('no source');
    await db.insert(notebookSources).values({ notebookId: notebook.id, sourceId: source.id });
    return source.id;
  };
  const first = await made('eins.md', SOURCE_STATUS.READY);
  const second = await made('zwei.md', SOURCE_STATUS.READY);
  await made('kaputt.md', SOURCE_STATUS.FAILED);
  for (const [index, sourceId] of [first, second].entries()) {
    await db.insert(chunks).values([
      {
        sourceId,
        ordinal: 0,
        text: `Abschnitt ${index}`,
        startOffset: 0,
        endOffset: 10,
        tokenCount: 3,
        embedding: axisVector(index, EMBEDDING_DIMENSIONS),
      },
      {
        sourceId,
        ordinal: 1,
        text: `Noch ein Abschnitt ${index}`,
        startOffset: 10,
        endOffset: 30,
        tokenCount: 5,
        embedding: axisVector(index + 2, EMBEDDING_DIMENSIONS),
      },
    ]);
  }
  return { userId: 'owner', notebookId: notebook.id };
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('findDemoTemplate', () => {
  it('finds the example notebook of the demo owner by the title', async () => {
    const template = await makeTemplate();

    expect(await findDemoTemplate(db, OWNER_EMAIL, TITLE)).toEqual(template);
  });

  it('finds nothing without the demo owner or without the notebook', async () => {
    expect(await findDemoTemplate(db, OWNER_EMAIL, TITLE)).toBeNull();
    await makeUser('owner', { email: OWNER_EMAIL });
    expect(await findDemoTemplate(db, OWNER_EMAIL, TITLE)).toBeNull();
  });
});

describe('copyNotebookToUser', () => {
  it('gives the guest a notebook of their own with the ready sources and their passages', async () => {
    const template = await makeTemplate();
    await makeUser('guest', { guest: true });

    const copied = await copyNotebookToUser(db, template, 'guest');

    const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, copied));
    expect(notebook?.userId).toBe('guest');
    expect(notebook?.title).toBe(TITLE);
    const copiedSources = await db.select().from(sources).where(eq(sources.userId, 'guest'));
    expect(copiedSources.map((source) => source.title).sort()).toEqual(['eins.md', 'zwei.md']);
    expect(copiedSources.every((source) => source.status === SOURCE_STATUS.READY)).toBe(true);
    expect(copiedSources.map((source) => source.canonicalText).sort()).toEqual([
      'Text von eins.md.',
      'Text von zwei.md.',
    ]);
    const copiedChunks = await db
      .select()
      .from(chunks)
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(eq(sources.userId, 'guest'));
    expect(copiedChunks).toHaveLength(4);
    expect(copiedChunks.map((row) => row.chunks.embedding?.indexOf(1)).sort()).toEqual([
      0, 1, 2, 3,
    ]);
    const links = await db
      .select()
      .from(notebookSources)
      .where(eq(notebookSources.notebookId, copied));
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.selected)).toBe(true);
  });

  it('takes the overview along and names the new set of sources, so no model call is needed', async () => {
    const template = await makeTemplate();
    await makeUser('guest', { guest: true });

    const copied = await copyNotebookToUser(db, template, 'guest');

    const found = await findNotebookForOverview(db, 'guest', copied);
    expect(found?.stored?.overview).toEqual({ emoji: '🔬', summary: 'Es geht um **Nordlicht**.' });
    expect(found?.stored?.key).toBe(notebookOverviewKey(found?.sources.map((s) => s.id) ?? []));
    expect(found?.sources).toHaveLength(2);
  });

  it('leaves the example as it was, and the copy lives on its own', async () => {
    const template = await makeTemplate();
    await makeUser('guest', { guest: true });
    await copyNotebookToUser(db, template, 'guest');

    await pool.query(`DELETE FROM "user" WHERE id = 'guest'`);

    const [{ count }] = (await pool.query(`SELECT count(*)::int AS count FROM chunks`)).rows;
    expect(count).toBe(4);
    expect(await db.select().from(sources).where(eq(sources.userId, 'owner'))).toHaveLength(3);
  });

  it('makes no overview where the example has none', async () => {
    const template = await makeTemplate();
    await db.update(notebooks).set({ overview: null, overviewKey: null });
    await makeUser('guest', { guest: true });

    const copied = await copyNotebookToUser(db, template, 'guest');

    expect((await findNotebookForOverview(db, 'guest', copied))?.stored).toBeNull();
  });

  it('does not copy a notebook of somebody else than the template owner', async () => {
    const template = await makeTemplate();
    await makeUser('guest', { guest: true });

    await expect(
      copyNotebookToUser(db, { ...template, userId: 'guest' }, 'guest')
    ).rejects.toThrow();
  });
});

describe('countGuests', () => {
  it('counts the guests that exist and those started within a time', async () => {
    await makeUser('old', { guest: true, ageMs: 3 * DAY_MS });
    await makeUser('new', { guest: true, ageMs: 5 * 60_000 });
    await makeUser('member', {});

    expect(await countGuests(db)).toBe(2);
    expect(await countGuests(db, new Date(Date.now() - HOUR_MS))).toBe(1);
  });
});

describe('deleteExpiredGuests', () => {
  it('deletes guests older than the limit with everything they own, and nobody else', async () => {
    const template = await makeTemplate();
    await makeUser('stale', { guest: true, ageMs: 8 * DAY_MS });
    await makeUser('fresh', { guest: true, ageMs: DAY_MS });
    await makeUser('member', { ageMs: 30 * DAY_MS });
    await copyNotebookToUser(db, template, 'stale');
    await copyNotebookToUser(db, template, 'fresh');

    const deleted = await deleteExpiredGuests(db, new Date(Date.now() - 7 * DAY_MS));

    expect(deleted).toEqual(['stale']);
    const left = await db.select({ id: user.id }).from(user);
    expect(left.map((row) => row.id).sort()).toEqual(['fresh', 'member', 'owner']);
    expect(await db.select().from(notebooks).where(eq(notebooks.userId, 'stale'))).toEqual([]);
    expect(await db.select().from(sources).where(eq(sources.userId, 'stale'))).toEqual([]);
    expect(await db.select().from(notebooks).where(eq(notebooks.userId, 'fresh'))).toHaveLength(1);
  });
});
