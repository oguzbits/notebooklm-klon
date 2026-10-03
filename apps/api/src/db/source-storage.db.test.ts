import {
  EMBEDDING_DIMENSIONS,
  SOURCE_FAILURE,
  SOURCE_KIND,
  SOURCE_STATUS,
  type SourceStatus,
} from '@nlm/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { chunks, sources } from './schema';
import { createSourceStorage, createUploadStorage, failInterruptedSources } from './source-storage';
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
  it('creates a PENDING source and says it is new', async () => {
    const created = await storage.findOrCreate(newSource());

    expect(created).toEqual({
      id: expect.any(String),
      status: SOURCE_STATUS.PENDING,
      created: true,
    });
  });

  it('returns the existing source for the same user and content instead of failing', async () => {
    const first = await storage.findOrCreate(newSource());
    await storage.markFailed(first.id, SOURCE_FAILURE.PARSE_FAILED);

    const again = await storage.findOrCreate(newSource());

    expect(again).toEqual({ id: first.id, status: SOURCE_STATUS.FAILED, created: false });
  });

  it('keeps the same content of two users apart', async () => {
    const first = await storage.findOrCreate(newSource('hash-1', USER));
    const other = await storage.findOrCreate(newSource('hash-1', 'user-b'));

    expect(other.created).toBe(true);
    expect(other.id).not.toBe(first.id);
  });

  it('makes one source when the same content arrives twice at once', async () => {
    const results = await Promise.all([
      storage.findOrCreate(newSource()),
      storage.findOrCreate(newSource()),
    ]);

    expect(results.map((result) => result.created).sort()).toEqual([false, true]);
    expect(results[0].id).toBe(results[1].id);
  });

  it('marks a source as PROCESSING and clears an earlier failure', async () => {
    const { id } = await storage.findOrCreate(newSource());
    await storage.markFailed(id, SOURCE_FAILURE.PARSE_FAILED);

    await storage.markProcessing(id);

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row).toMatchObject({ status: SOURCE_STATUS.PROCESSING, errorMessage: null });
  });

  it('marks a source as FAILED with the failure code', async () => {
    const { id } = await storage.findOrCreate(newSource());

    await storage.markFailed(id, SOURCE_FAILURE.EMPTY_TEXT);

    const [row] = await db.select().from(sources).where(eq(sources.id, id));
    expect(row).toMatchObject({
      status: SOURCE_STATUS.FAILED,
      errorMessage: SOURCE_FAILURE.EMPTY_TEXT,
    });
  });

  it('stores text, page count and chunks with offsets and vectors when READY', async () => {
    const { id } = await storage.findOrCreate(newSource());

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
    const { id } = await storage.findOrCreate(newSource());
    await storage.markReady(id, readyResult());

    await storage.markReady(id, { ...readyResult(), chunks: readyResult().chunks.slice(0, 1) });

    expect(await db.select().from(chunks).where(eq(chunks.sourceId, id))).toHaveLength(1);
  });

  it('keeps the source unchanged when storing the chunks fails', async () => {
    const { id } = await storage.findOrCreate(newSource());
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

describe('failing sources an interrupted job left behind', () => {
  const HOUR_MS = 60 * 60 * 1000;
  const cutoff = () => new Date(Date.now() - HOUR_MS);

  /** A source with an upload of the given age and the given status, as a job leaves it when the process dies. */
  async function leftBehind(hash: string, status: SourceStatus, ageMs: number) {
    const { id } = await storage.findOrCreate(newSource(hash));
    await db.update(sources).set({ status }).where(eq(sources.id, id));
    await uploads.put(id, new Uint8Array([1]));
    await pool.query(`UPDATE source_uploads SET created_at = $1 WHERE source_id = $2`, [
      new Date(Date.now() - ageMs),
      id,
    ]);
    return id;
  }
  const statusOf = async (id: string) =>
    (await db.select({ status: sources.status }).from(sources).where(eq(sources.id, id)))[0]
      ?.status;

  it('fails a PENDING or PROCESSING source whose upload is older than the cutoff and keeps the upload', async () => {
    const pending = await leftBehind('h-pending', SOURCE_STATUS.PENDING, 2 * HOUR_MS);
    const processing = await leftBehind('h-processing', SOURCE_STATUS.PROCESSING, 2 * HOUR_MS);

    expect(await failInterruptedSources(db, cutoff())).toBe(2);

    for (const id of [pending, processing]) {
      expect(await statusOf(id)).toBe(SOURCE_STATUS.FAILED);
      // Kept, so the user can read the source again.
      expect(await uploads.load(id)).not.toBeNull();
    }
    const [row] = await db
      .select({ errorMessage: sources.errorMessage })
      .from(sources)
      .where(eq(sources.id, pending));
    expect(row?.errorMessage).toBe(SOURCE_FAILURE.INTERRUPTED);
  });

  it('leaves a source alone whose job may still be running or waiting', async () => {
    const fresh = await leftBehind('h-fresh', SOURCE_STATUS.PROCESSING, 1000);

    expect(await failInterruptedSources(db, cutoff())).toBe(0);
    expect(await statusOf(fresh)).toBe(SOURCE_STATUS.PROCESSING);
    expect(await uploads.load(fresh)).not.toBeNull();
  });

  it('leaves READY and FAILED sources alone, however old their upload is', async () => {
    const ready = await leftBehind('h-ready', SOURCE_STATUS.READY, 2 * HOUR_MS);
    const failed = await leftBehind('h-failed', SOURCE_STATUS.FAILED, 2 * HOUR_MS);

    expect(await failInterruptedSources(db, cutoff())).toBe(0);
    expect(await statusOf(ready)).toBe(SOURCE_STATUS.READY);
    expect(await statusOf(failed)).toBe(SOURCE_STATUS.FAILED);
  });
});

describe('upload storage', () => {
  it('keeps the bytes and kind of a source until they are removed', async () => {
    const { id } = await storage.findOrCreate(newSource());
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);

    await uploads.put(id, bytes);

    expect(await uploads.load(id)).toEqual({ kind: SOURCE_KIND.PDF, bytes });
    await uploads.remove(id);
    expect(await uploads.load(id)).toBeNull();
  });

  it('replaces the bytes when a failed source is uploaded again', async () => {
    const { id } = await storage.findOrCreate(newSource());
    await uploads.put(id, new Uint8Array([1]));

    await uploads.put(id, new Uint8Array([2, 2]));

    expect((await uploads.load(id))?.bytes).toEqual(new Uint8Array([2, 2]));
  });

  it('returns null for a source without an upload', async () => {
    const { id } = await storage.findOrCreate(newSource());

    expect(await uploads.load(id)).toBeNull();
  });

  it('is removed together with its source', async () => {
    const { id } = await storage.findOrCreate(newSource());
    await uploads.put(id, new Uint8Array([1]));

    await db.delete(sources).where(eq(sources.id, id));

    const rows = await pool.query('SELECT 1 FROM source_uploads WHERE source_id = $1', [id]);
    expect(rows.rowCount).toBe(0);
  });
});
