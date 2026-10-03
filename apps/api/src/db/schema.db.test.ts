import { EMBEDDING_DIMENSIONS, SOURCE_KIND } from '@nlm/shared';
import { asc, cosineDistance, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { chunks, notebooks, notebookSources, sources } from './schema';
import { axisVector, createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const USER = 'user-a';
// Drizzle wraps the driver error; the Postgres error code sits in `cause`.
const UNIQUE_VIOLATION_ERROR = { cause: { code: '23505' } };

async function insertSource(userId: string, contentHash: string) {
  const [source] = await db
    .insert(sources)
    .values({ userId, contentHash, kind: SOURCE_KIND.PDF, title: 'Quelle' })
    .returning();
  if (!source) throw new Error('insert returned no row');
  return source;
}

async function insertChunk(sourceId: string, ordinal: number, text: string, axis?: number) {
  await db.insert(chunks).values({
    sourceId,
    ordinal,
    text,
    startOffset: ordinal * 100,
    endOffset: ordinal * 100 + text.length,
    embedding: axis === undefined ? null : axisVector(axis, EMBEDDING_DIMENSIONS),
  });
}

beforeEach(async () => {
  await pool.query('TRUNCATE sources, notebooks CASCADE');
  await ensureUsers(pool, ['user-a']);
});

afterAll(async () => {
  await pool.end();
});

describe('migrations', () => {
  it('enable pgvector and create all tables', async () => {
    const extension = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );

    expect(extension.rowCount).toBe(1);
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['chunks', 'notebook_sources', 'notebooks', 'sources'])
    );
  });
});

describe('sources', () => {
  it('reject a second source with the same content hash for the same user', async () => {
    await insertSource(USER, 'hash-1');

    await expect(insertSource(USER, 'hash-1')).rejects.toMatchObject(UNIQUE_VIOLATION_ERROR);
  });

  it('reject a status outside the enum', async () => {
    const source = await insertSource(USER, 'hash-1');

    await expect(
      pool.query("UPDATE sources SET status = 'DONE' WHERE id = $1", [source.id])
    ).rejects.toThrow(/invalid input value for enum/);
  });
});

describe('cascades', () => {
  it('deleting a source removes its chunks and notebook links', async () => {
    const source = await insertSource(USER, 'hash-1');
    const [notebook] = await db.insert(notebooks).values({ userId: USER, title: 'N' }).returning();
    await db.insert(notebookSources).values({ notebookId: notebook!.id, sourceId: source.id });
    await insertChunk(source.id, 0, 'Text');

    await db.delete(sources).where(eq(sources.id, source.id));

    expect(await db.select().from(chunks)).toHaveLength(0);
    expect(await db.select().from(notebookSources)).toHaveLength(0);
  });

  it('deleting a notebook keeps the source, so it can be reused elsewhere', async () => {
    const source = await insertSource(USER, 'hash-1');
    const [notebook] = await db.insert(notebooks).values({ userId: USER, title: 'N' }).returning();
    await db.insert(notebookSources).values({ notebookId: notebook!.id, sourceId: source.id });

    await db.delete(notebooks).where(eq(notebooks.id, notebook!.id));

    expect(await db.select().from(sources)).toHaveLength(1);
    expect(await db.select().from(notebookSources)).toHaveLength(0);
  });
});

describe('chunks', () => {
  it('keep one chunk per ordinal within a source', async () => {
    const source = await insertSource(USER, 'hash-1');
    await insertChunk(source.id, 0, 'Erster');

    await expect(insertChunk(source.id, 0, 'Doppelt')).rejects.toMatchObject(
      UNIQUE_VIOLATION_ERROR
    );
  });

  it('return the nearest vector first', async () => {
    const source = await insertSource(USER, 'hash-1');
    await insertChunk(source.id, 0, 'null', 0);
    await insertChunk(source.id, 1, 'eins', 1);
    await insertChunk(source.id, 2, 'zwei', 2);

    const [nearest] = await db
      .select({ text: chunks.text })
      .from(chunks)
      .orderBy(asc(cosineDistance(chunks.embedding, axisVector(1, EMBEDDING_DIMENSIONS))))
      .limit(1);

    expect(nearest?.text).toBe('eins');
  });

  it('can use the HNSW index for the vector search', async () => {
    const source = await insertSource(USER, 'hash-1');
    await insertChunk(source.id, 0, 'eins', 1);
    const query = `[${axisVector(1, EMBEDDING_DIMENSIONS).join(',')}]`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const plan = await client.query(
        'EXPLAIN SELECT id FROM chunks ORDER BY embedding <=> $1::vector LIMIT 1',
        [query]
      );
      await client.query('ROLLBACK');

      expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
        'chunks_embedding_hnsw_idx'
      );
    } finally {
      client.release();
    }
  });

  it('match full-text search in German and English text', async () => {
    const source = await insertSource(USER, 'hash-1');
    await insertChunk(source.id, 0, 'Der Umsatz stieg im dritten Quartal um 12 Prozent.');
    await insertChunk(source.id, 1, 'Revenue grew by 12 percent in the third quarter.');

    const match = async (term: string) =>
      db
        .select({ ordinal: chunks.ordinal })
        .from(chunks)
        .where(sql`${chunks.searchVector} @@ plainto_tsquery('simple', ${term})`);

    expect(await match('umsatz')).toEqual([{ ordinal: 0 }]);
    expect(await match('revenue')).toEqual([{ ordinal: 1 }]);
    expect(await match('kosten')).toEqual([]);
  });
});
