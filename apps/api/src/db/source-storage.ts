import { SOURCE_STATUS } from '@nlm/shared';
import { and, eq } from 'drizzle-orm';

import type { IngestPorts } from '../ingestion/ingest';
import type { Database } from './client';
import { chunks, sources } from './schema';

/** PostgreSQL implementation of the storage half of the ingestion pipeline. */
export function createSourceStorage(db: Database): IngestPorts['sources'] {
  return {
    async findByHash(userId, contentHash) {
      const [row] = await db
        .select({ id: sources.id, status: sources.status })
        .from(sources)
        .where(and(eq(sources.userId, userId), eq(sources.contentHash, contentHash)));
      return row ?? null;
    },

    async create(input) {
      const [row] = await db.insert(sources).values(input).returning({ id: sources.id });
      if (!row) throw new Error('insert returned no row');
      return row;
    },

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
