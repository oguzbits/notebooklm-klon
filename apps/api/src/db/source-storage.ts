import { SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';

import { LIMITS } from '../config/limits';
import { type IngestPorts, QuotaExceededError } from '../ingestion/ingest';
import type { SubmitPorts } from '../ingestion/submit';
import type { Database } from './client';
import { countSourcesSince } from './notebook-source-repository';
import { chunks, sources, sourceUploads } from './schema';

type NewSource = Parameters<IngestPorts['sources']['findOrCreate']>[0];

async function findOrCreateSource(db: Database, input: NewSource, enforceQuota: boolean) {
  // One transaction per user at a time, so two uploads at once can neither both slip under the
  // quota nor both insert the same content.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId}))`);
    const [created] = await tx
      .insert(sources)
      .values(input)
      .onConflictDoNothing({ target: [sources.userId, sources.contentHash] })
      .returning({ id: sources.id, status: sources.status });
    if (created) {
      if (enforceQuota && (await isOverQuota(tx, input.userId))) throw new QuotaExceededError();
      return { ...created, created: true };
    }
    const [existing] = await tx
      .select({ id: sources.id, status: sources.status })
      .from(sources)
      .where(and(eq(sources.userId, input.userId), eq(sources.contentHash, input.contentHash)));
    if (!existing) throw new Error('source vanished between insert and select');
    return { ...existing, created: false };
  });
}

/**
 * PostgreSQL implementation of the storage half of the ingestion pipeline. With `enforceQuota` a
 * new source counts against the user's quota: that is for the API, not for the seed and eval scripts.
 */
export function createSourceStorage(
  db: Database,
  options: { enforceQuota: boolean }
): IngestPorts['sources'] {
  return {
    findOrCreate: (input) => findOrCreateSource(db, input, options.enforceQuota),

    async markProcessing(sourceId) {
      await db
        .update(sources)
        .set({ status: SOURCE_STATUS.PROCESSING, errorMessage: null })
        .where(eq(sources.id, sourceId));
    },

    async markReady(sourceId, result) {
      // One transaction: either the source is READY with all its chunks or nothing changes.
      await db.transaction(async (tx) => {
        await tx.delete(chunks).where(eq(chunks.sourceId, sourceId));
        await tx.insert(chunks).values(
          result.chunks.map((chunk) => ({
            sourceId,
            ordinal: chunk.ordinal,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            embedding: chunk.embedding,
          }))
        );
        await tx
          .update(sources)
          .set({
            status: SOURCE_STATUS.READY,
            canonicalText: result.canonicalText,
            pageCount: result.pageCount,
            errorMessage: null,
          })
          .where(eq(sources.id, sourceId));
      });
    },

    async markFailed(sourceId, failure) {
      await db
        .update(sources)
        .set({ status: SOURCE_STATUS.FAILED, errorMessage: failure })
        .where(eq(sources.id, sourceId));
    },
  };
}

async function isOverQuota(tx: Pick<Database, 'select'>, userId: string): Promise<boolean> {
  const used = await countSourcesSince(tx, userId, LIMITS.QUOTA_WINDOW_HOURS);
  return used > LIMITS.SOURCES_PER_USER_PER_WINDOW;
}

/**
 * A job the process did not finish (restart, crash) leaves its source PENDING or PROCESSING with the
 * upload still stored, and the queue does not retry it. Such sources are failed so the user can
 * upload again. Returns how many there were.
 */
export async function failInterruptedSources(db: Database, olderThan: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .select({ id: sources.id })
      .from(sources)
      .innerJoin(sourceUploads, eq(sourceUploads.sourceId, sources.id))
      .where(
        and(
          inArray(sources.status, [SOURCE_STATUS.PENDING, SOURCE_STATUS.PROCESSING]),
          lt(sourceUploads.createdAt, olderThan)
        )
      );
    const ids = stale.map((row) => row.id);
    if (ids.length === 0) return 0;
    await tx
      .update(sources)
      .set({ status: SOURCE_STATUS.FAILED, errorMessage: SOURCE_FAILURE.INTERRUPTED })
      .where(inArray(sources.id, ids));
    await tx.delete(sourceUploads).where(inArray(sourceUploads.sourceId, ids));
    return ids.length;
  });
}

/** Holds the raw bytes of an upload until its ingestion job has run. */
export function createUploadStorage(db: Database): SubmitPorts['uploads'] {
  return {
    async put(sourceId, bytes) {
      await db
        .insert(sourceUploads)
        .values({ sourceId, bytes })
        .onConflictDoUpdate({ target: sourceUploads.sourceId, set: { bytes } });
    },

    async load(sourceId) {
      const [row] = await db
        .select({ bytes: sourceUploads.bytes, kind: sources.kind })
        .from(sourceUploads)
        .innerJoin(sources, eq(sources.id, sourceUploads.sourceId))
        .where(eq(sourceUploads.sourceId, sourceId));
      return row ? { kind: row.kind, bytes: new Uint8Array(row.bytes) } : null;
    },

    async remove(sourceId) {
      await db.delete(sourceUploads).where(eq(sourceUploads.sourceId, sourceId));
    },
  };
}
