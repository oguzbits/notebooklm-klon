import { SOURCE_KIND, SOURCE_STATUS, type SourceOverview } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { findSourceForOverview, saveOverview } from './overview-repository';
import { notebooks, notebookSources, sources } from './schema';
import { createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'overview-user-a';
const OTHER_USER = 'overview-user-b';
const OVERVIEW: SourceOverview = {
  summary: 'Zusammenfassung.',
  keyTopics: ['Thema'],
  suggestedQuestions: ['Frage?'],
};

async function setup(userId: string, canonicalText: string | null = 'Text der Quelle.') {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'N' }).returning();
  const [source] = await db
    .insert(sources)
    .values({
      userId,
      contentHash: `${userId}-${Math.random()}`,
      kind: SOURCE_KIND.TXT,
      title: 'quelle.txt',
      status: SOURCE_STATUS.READY,
      canonicalText,
    })
    .returning();
  if (!notebook || !source) throw new Error('insert returned no row');
  await db.insert(notebookSources).values({ notebookId: notebook.id, sourceId: source.id });
  return { notebook, source };
}

beforeEach(async () => {
  await pool.query('TRUNCATE "user" CASCADE');
  await ensureUsers(pool, [USER, OTHER_USER]);
});

afterAll(async () => {
  await pool.end();
});

describe('overview storage', () => {
  it('finds a source without an overview, then with the saved one', async () => {
    const { notebook, source } = await setup(USER);

    expect(await findSourceForOverview(db, USER, notebook.id, source.id)).toEqual({
      title: 'quelle.txt',
      text: 'Text der Quelle.',
      overview: null,
    });

    await saveOverview(db, USER, source.id, OVERVIEW);

    expect(await findSourceForOverview(db, USER, notebook.id, source.id)).toMatchObject({
      overview: OVERVIEW,
    });
  });

  it('finds nothing for a source of another user, outside the notebook or without text', async () => {
    const mine = await setup(USER);
    const theirs = await setup(OTHER_USER);
    const noText = await setup(USER, null);
    const elsewhere = await setup(USER);
    await pool.query('DELETE FROM notebook_sources WHERE source_id = $1', [elsewhere.source.id]);

    expect(await findSourceForOverview(db, USER, mine.notebook.id, theirs.source.id)).toBeNull();
    expect(await findSourceForOverview(db, USER, theirs.notebook.id, theirs.source.id)).toBeNull();
    expect(await findSourceForOverview(db, USER, noText.notebook.id, noText.source.id)).toBeNull();
    expect(
      await findSourceForOverview(db, USER, elsewhere.notebook.id, elsewhere.source.id)
    ).toBeNull();
    expect(await findSourceForOverview(db, USER, mine.notebook.id, 'kein-uuid')).toBeNull();
  });

  it("does not write the overview of another user's source", async () => {
    const theirs = await setup(OTHER_USER);

    await saveOverview(db, USER, theirs.source.id, OVERVIEW);

    expect(
      await findSourceForOverview(db, OTHER_USER, theirs.notebook.id, theirs.source.id)
    ).toMatchObject({ overview: null });
  });

  it('throws when the stored overview does not fit the contract', async () => {
    const { notebook, source } = await setup(USER);
    await pool.query('UPDATE sources SET overview = \'{"summary":""}\' WHERE id = $1', [source.id]);

    await expect(findSourceForOverview(db, USER, notebook.id, source.id)).rejects.toThrow();
  });
});
