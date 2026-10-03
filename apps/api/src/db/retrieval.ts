import { sql } from 'drizzle-orm';

import { searchWords } from '../core/search-words';
import type { Database } from './client';

/** Reciprocal Rank Fusion constant from the original paper; damps the weight of top ranks. */
const RRF_K = 60;
/**
 * Weight of the full-text ranking relative to the vector ranking (1). Words cannot match across
 * languages, so a German question against an English source gets only noise from the text side.
 * Not tuned by measurement: on the 18 golden questions 0.5 and 1.0 differ by one hit, and that
 * flips with rounding (float8 against numeric), so the sample cannot tell them apart.
 */
const TEXT_WEIGHT = 0.5;
/** Candidates each ranker (vector, full text) hands to the fusion. */
const CANDIDATES_PER_RANKER = 20;

export interface SearchParams {
  /** From the server-side session, never from the client. */
  userId: string;
  notebookId: string;
  /** The sources the user selected in this notebook. */
  sourceIds: string[];
  queryEmbedding: number[];
  queryText: string;
  limit: number;
}

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  startOffset: number;
  endOffset: number;
  score: number;
}

type ChunkRow = {
  id: string;
  source_id: string;
  ordinal: number;
  text: string;
  start_offset: number;
  end_offset: number;
  score: number;
};

function toRetrievedChunk(row: ChunkRow): RetrievedChunk {
  return {
    id: row.id,
    sourceId: row.source_id,
    ordinal: row.ordinal,
    text: row.text,
    startOffset: row.start_offset,
    endOffset: row.end_offset,
    score: row.score,
  };
}

/** The chunks the user may see in this notebook, limited to the selected sources. */
function scopedChunks(params: SearchParams) {
  const sourceIdList = sql.join(
    params.sourceIds.map((id) => sql`${id}::uuid`),
    sql`, `
  );
  return sql`
    SELECT c.id, c.source_id, c.embedding, c.search_vector
    FROM chunks c
    JOIN sources s ON s.id = c.source_id AND s.user_id = ${params.userId}
    JOIN notebook_sources ns ON ns.source_id = s.id AND ns.notebook_id = ${params.notebookId}
    JOIN notebooks n ON n.id = ns.notebook_id AND n.user_id = ${params.userId}
    WHERE c.source_id IN (${sourceIdList})`;
}

/**
 * The nearest vectors, plus the nearest one of every source: with several sources in a notebook, a
 * source in another language than the question (a German question about an English paper) ranks
 * behind all the others, yet it can hold the answer. The rank stays the one among all chunks.
 */
function vectorRanked(queryEmbedding: number[]) {
  const vector = `[${queryEmbedding.join(',')}]`;
  return sql`
    SELECT id, rank FROM (
      SELECT id,
        row_number() OVER (ORDER BY embedding <=> ${vector}::vector, id) AS rank,
        row_number() OVER (PARTITION BY source_id ORDER BY embedding <=> ${vector}::vector, id) AS source_rank
      FROM scoped
      WHERE embedding IS NOT NULL
    ) nearest
    WHERE rank <= ${CANDIDATES_PER_RANKER} OR source_rank = 1
    ORDER BY rank`;
}

function textRanked(queryText: string) {
  const words = searchWords(queryText);
  if (words.length === 0) return sql`SELECT id, 0 AS rank FROM scoped WHERE false`;
  const wordList = sql.join(
    words.map((word) => sql`${word}`),
    sql`, `
  );
  // Filler words match nearly every chunk and would push the right ones down the fused ranking.
  // ts_lexize returns an empty array for a stop word, checked for German and English.
  return sql`
    SELECT id, row_number() OVER (ORDER BY ts_rank_cd(search_vector, terms.query) DESC, id) AS rank
    FROM scoped,
      (
        SELECT to_tsquery('simple', string_agg(word, ' | ')) AS query
        FROM unnest(ARRAY[${wordList}]::text[]) AS word
        WHERE ts_lexize('german_stem', word) IS DISTINCT FROM '{}'
          AND ts_lexize('english_stem', word) IS DISTINCT FROM '{}'
      ) AS terms
    WHERE search_vector @@ terms.query
    ORDER BY ts_rank_cd(search_vector, terms.query) DESC, id
    LIMIT ${CANDIDATES_PER_RANKER}`;
}

/**
 * Hybrid search: nearest vectors plus full-text matches, fused with RRF, all inside PostgreSQL.
 * Scope is enforced in SQL: the chunk's source must belong to the user, the notebook must belong to
 * the user and contain the source, and the source must be among the selected ones. The scan over
 * the scoped chunks is exact, which is fine at this scale and never skips a chunk to an ANN index.
 * Every selected source that has a vector gets its best passage into the result first, the rest of
 * the slots go by score, so a source in another language than the question is not crowded out.
 */
export async function searchChunks(db: Database, params: SearchParams): Promise<RetrievedChunk[]> {
  if (params.sourceIds.length === 0) return [];

  const result = await db.execute<ChunkRow>(sql`
    WITH scoped AS (${scopedChunks(params)}),
    vector_ranked AS (${vectorRanked(params.queryEmbedding)}),
    text_ranked AS (${textRanked(params.queryText)}),
    fused AS (
      SELECT id, sum(part) AS score
      FROM (SELECT id, 1.0 / (${RRF_K} + rank) AS part FROM vector_ranked
        UNION ALL
        SELECT id, ${TEXT_WEIGHT}::numeric / (${RRF_K} + rank) AS part FROM text_ranked) ranked
      GROUP BY id
    ),
    picked AS (
      SELECT id, source_id, ordinal, text, start_offset, end_offset, score
      FROM (
        SELECT c.id, c.source_id, c.ordinal, c.text, c.start_offset, c.end_offset,
          fused.score::float8 AS score,
          row_number() OVER (PARTITION BY c.source_id ORDER BY fused.score DESC, c.id) AS source_rank
        FROM fused
        JOIN chunks c ON c.id = fused.id
      ) ranked
      ORDER BY (source_rank = 1) DESC, score DESC, id
      LIMIT ${params.limit}
    )
  SELECT * FROM picked ORDER BY score DESC, id
  `);

  return result.rows.map(toRetrievedChunk);
}
