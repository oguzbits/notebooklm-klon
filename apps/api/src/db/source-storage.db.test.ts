import { EMBEDDING_DIMENSIONS, SOURCE_FAILURE, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { chunks, sources } from './schema';
import { createSourceStorage, createUploadStorage } from './source-storage';
import { axisVector, createTestDb, ensureUsers } from './testing/test-db';

const { db, pool } = createTestDb();
const storage = createSourceStorage(db);
const uploads = createUploadStorage(db);
const USER = 'user-a';

const newSource = (contentHash = 'hash-1', userId = USER) => ({
  userId,
  contentHash,
  kind: SOURCE_KIND.PDF,
  title: 'Quelle',
  sourceUrl: null,
});

const readyResult = () => ({
  canonicalText: 'Erster Teil. Zweiter Teil.',
  pageCount: 3,
  chunks: [
    {
      ordinal: 0,
      text: 'Erster Teil.',
      startOffset: 0,
      endOffset: 12,
      embedding: axisVector(0, EMBEDDING_DIMENSIONS),
    },
    {
      ordinal: 1,
      text: 'Zweiter Teil.',
      startOffset: 13,
      endOffset: 26,
      embedding: axisVector(1, EMBEDDING_DIMENSIONS),
    },
  ],
});

beforeEach(async () => {
  await pool.query('TRUNCATE sources, notebooks CASCADE');
  await ensureUsers(pool, ['user-a', 'user-b']);
});

afterAll(async () => {
  await pool.end();
});

describe('source storage', () => {
  it('finds a source by user and content hash', async () => {
    const { id } = await storage.create(newSource());

    expect(await storage.findByHash(USER, 'hash-1')).toEqual({ id, status: SOURCE_STATUS.PENDING });
  });

  it('does not find a source of another user or another hash', async () => {
    await storage.create(newSource());

    expect(await storage.findByHash('user-b', 'hash-1')).toBeNull();
    expect(await storage.findByHash(USER, 'hash-2')).toBeNull();
  });

  it('refuses a second source with the same content for the same user', async () => {
    await storage.create(newSource());

    await expect(storage.create(newSource())).rejects.toThrow();
  });

  it('marks a source as PROCESSING and clears an earlier failure', async () => {
    const { id } = await storage.create(newSource());
    await storage.markFailed(id, SOURCE_FAILURE.PARSE_FAILED);

    await storage.markProcessing(id);

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row).toMatchObject({ status: SOURCE_STATUS.PROCESSING, errorMessage: null });
  });

  it('marks a source as FAILED with the failure code', async () => {
    const { id } = await storage.create(newSource());

    await storage.markFailed(id, SOURCE_FAILURE.EMPTY_TEXT);

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row).toMatchObject({
      status: SOURCE_STATUS.FAILED,
      errorMessage: SOURCE_FAILURE.EMPTY_TEXT,
    });
  });

  it('stores text, page count and chunks with offsets and vectors when READY', async () => {
    const { id } = await storage.create(newSource());

    await storage.markReady(id, readyResult());

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row).toMatchObject({
      status: SOURCE_STATUS.READY,
      canonicalText: 'Erster Teil. Zweiter Teil.',
      pageCount: 3,
      errorMessage: null,
    });
    const stored = await db
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, id))
      .orderBy(chunks.ordinal);
    expect(stored.map((c) => [c.ordinal, c.text, c.startOffset, c.endOffset])).toEqual([
      [0, 'Erster Teil.', 0, 12],
      [1, 'Zweiter Teil.', 13, 26],
    ]);
    expect(stored[0]?.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('replaces the chunks of an earlier attempt instead of adding to them', async () => {
    const { id } = await storage.create(newSource());
    await storage.markReady(id, readyResult());

    await storage.markReady(id, { ...readyResult(), chunks: readyResult().chunks.slice(0, 1) });

    expect(await db.select().from(chunks).where(eq(chunks.sourceId, id))).toHaveLength(1);
  });

  it('keeps the source unchanged when storing the chunks fails', async () => {
    const { id } = await storage.create(newSource());
    const broken = {
      ...readyResult(),
      chunks: [{ ...readyResult().chunks[0]!, embedding: [1, 2, 3] }],
    };

    await expect(storage.markReady(id, broken)).rejects.toThrow();

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row?.status).toBe(SOURCE_STATUS.PENDING);
    expect(await db.select().from(chunks).where(eq(chunks.sourceId, id))).toHaveLength(0);
  });
});

describe('upload storage', () => {
  it('keeps the bytes and kind of a source until they are removed', async () => {
    const { id } = await storage.create(newSource());
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);

    await uploads.put(id, bytes);

    expect(await uploads.load(id)).toEqual({ kind: SOURCE_KIND.PDF, bytes });
    await uploads.remove(id);
    expect(await uploads.load(id)).toBeNull();
  });

  it('replaces the bytes when a failed source is uploaded again', async () => {
    const { id } = await storage.create(newSource());
    await uploads.put(id, new Uint8Array([1]));

    await uploads.put(id, new Uint8Array([2, 2]));

    expect((await uploads.load(id))?.bytes).toEqual(new Uint8Array([2, 2]));
  });

  it('returns null for a source without an upload', async () => {
    const { id } = await storage.create(newSource());

    expect(await uploads.load(id)).toBeNull();
  });

  it('is removed together with its source', async () => {
    const { id } = await storage.create(newSource());
    await uploads.put(id, new Uint8Array([1]));

    await db.delete(sources).where(eq(sources.id, id));

    const rows = await pool.query('SELECT 1 FROM source_uploads WHERE source_id = $1', [id]);
    expect(rows.rowCount).toBe(0);
  });
});
