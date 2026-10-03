import { EMBEDDING_DIMENSIONS, SOURCE_KIND } from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { searchChunks } from './retrieval';
import { chunks, notebooks, notebookSources, sources } from './schema';
import { axisVector, createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'user-a';
const OTHER_USER = 'user-b';
const LIMIT = 5;

async function insertNotebook(userId: string) {
  const [notebook] = await db.insert(notebooks).values({ userId, title: 'Notizbuch' }).returning();
  if (!notebook) throw new Error('insert returned no row');
  return notebook;
}

async function insertSource(userId: string, notebookId: string, contentHash: string) {
  const [source] = await db
    .insert(sources)
    .values({ userId, contentHash, kind: SOURCE_KIND.PDF, title: contentHash })
    .returning();
  if (!source) throw new Error('insert returned no row');
  await db.insert(notebookSources).values({ notebookId, sourceId: source.id });
  return source;
}

async function insertChunk(sourceId: string, ordinal: number, text: string, axis?: number) {
  const [chunk] = await db
    .insert(chunks)
    .values({
      sourceId,
      ordinal,
      text,
      startOffset: 0,
      endOffset: text.length,
      embedding: axis === undefined ? null : axisVector(axis, EMBEDDING_DIMENSIONS),
    })
    .returning();
  if (!chunk) throw new Error('insert returned no row');
  return chunk;
}

const search = (
  scope: { userId: string; notebookId: string; sourceIds: string[] },
  queryAxis: number,
  queryText: string,
  limit = LIMIT
) =>
  searchChunks(db, {
    ...scope,
    queryEmbeddings: [axisVector(queryAxis, EMBEDDING_DIMENSIONS)],
    queryText,
    limit,
  });

beforeEach(async () => {
  await pool.query('TRUNCATE sources, notebooks CASCADE');
  await ensureUsers(pool, ['user-a', 'user-b']);
});

afterAll(async () => {
  await pool.end();
});

describe('searchChunks scope', () => {
  it('returns only chunks of the selected sources', async () => {
    const notebook = await insertNotebook(USER);
    const selected = await insertSource(USER, notebook.id, 'selected');
    const unselected = await insertSource(USER, notebook.id, 'unselected');
    await insertChunk(selected.id, 0, 'ausgewählt', 0);
    await insertChunk(unselected.id, 0, 'abgewählt', 0);

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [selected.id] },
      0,
      'ausgewählt'
    );

    expect(results.map((r) => r.text)).toEqual(['ausgewählt']);
  });

  it('returns nothing for a source that is not linked to the notebook', async () => {
    const notebook = await insertNotebook(USER);
    const otherNotebook = await insertNotebook(USER);
    const foreign = await insertSource(USER, otherNotebook.id, 'foreign');
    await insertChunk(foreign.id, 0, 'fremdes Notizbuch', 0);

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [foreign.id] },
      0,
      'fremdes'
    );

    expect(results).toEqual([]);
  });

  it("never returns another user's chunks, even with their notebook and source IDs", async () => {
    const theirNotebook = await insertNotebook(OTHER_USER);
    const theirSource = await insertSource(OTHER_USER, theirNotebook.id, 'theirs');
    await insertChunk(theirSource.id, 0, 'geheim', 0);

    const results = await search(
      { userId: USER, notebookId: theirNotebook.id, sourceIds: [theirSource.id] },
      0,
      'geheim'
    );

    expect(results).toEqual([]);
  });

  it('returns nothing when no source is selected', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    await insertChunk(source.id, 0, 'Text', 0);

    expect(
      await search({ userId: USER, notebookId: notebook.id, sourceIds: [] }, 0, 'Text')
    ).toEqual([]);
  });
});

describe('searchChunks ranking', () => {
  it('ranks the chunk that matches by meaning and by words above single matches', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    await insertChunk(source.id, 0, 'nur Bedeutung', 0);
    await insertChunk(source.id, 1, 'nur Stichwort Budget', 1);
    await insertChunk(source.id, 2, 'beides Budget Budget Budget', 0);

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
      0,
      'Budget'
    );

    expect(results[0]?.text).toBe('beides Budget Budget Budget');
    expect(results).toHaveLength(3);
  });

  it('finds a chunk by its words alone when its vector is far away or missing', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    await insertChunk(source.id, 0, 'ohne Bezug', 0);
    await insertChunk(source.id, 1, 'Höhe des Budgets 1,25 Millionen', 3);
    await insertChunk(source.id, 2, 'Budget ohne Vektor');

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
      0,
      'Budget 2018'
    );

    const texts = results.map((r) => r.text);
    expect(texts).toContain('Höhe des Budgets 1,25 Millionen');
    expect(texts).toContain('Budget ohne Vektor');
  });

  it('finds a chunk by the vector of any version of the question', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    // One distractor only: with two, a tie broken by the random ID can put one of them second in both
    // rankings, and that outscores a chunk that is first in just one.
    await insertChunk(source.id, 0, 'ohne Bezug', 0);
    await insertChunk(source.id, 1, 'passt zur ersten Fassung', 3);
    await insertChunk(source.id, 2, 'passt zur zweiten Fassung', 1);

    const results = await searchChunks(db, {
      userId: USER,
      notebookId: notebook.id,
      sourceIds: [source.id],
      queryEmbeddings: [axisVector(3, EMBEDDING_DIMENSIONS), axisVector(1, EMBEDDING_DIMENSIONS)],
      queryText: '?',
      limit: 2,
    });

    expect(results.map((r) => r.text).sort()).toEqual([
      'passt zur ersten Fassung',
      'passt zur zweiten Fassung',
    ]);
  });

  it('respects the limit', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    for (let ordinal = 0; ordinal < 4; ordinal += 1) {
      await insertChunk(source.id, ordinal, `Abschnitt ${ordinal}`, ordinal);
    }

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
      0,
      'Abschnitt',
      2
    );

    expect(results).toHaveLength(2);
  });

  it('treats query syntax in the question as plain words', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    await insertChunk(source.id, 0, 'Text', 0);

    await expect(
      search(
        { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
        0,
        "a' & !b:* | (c) <-> \\"
      )
    ).resolves.toBeDefined();
  });

  it('still answers from the vector when the question has no searchable words', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    await insertChunk(source.id, 0, 'Text', 0);

    const results = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
      0,
      '?!'
    );

    expect(results.map((r) => r.text)).toEqual(['Text']);
  });

  it('returns chunk location data for the reader highlight', async () => {
    const notebook = await insertNotebook(USER);
    const source = await insertSource(USER, notebook.id, 'a');
    const chunk = await insertChunk(source.id, 7, 'Text', 0);

    const [result] = await search(
      { userId: USER, notebookId: notebook.id, sourceIds: [source.id] },
      0,
      'Text'
    );

    expect(result).toMatchObject({
      id: chunk.id,
      sourceId: source.id,
      ordinal: 7,
      startOffset: 0,
      endOffset: 4,
    });
  });
});
