import { CHAT_ROLE, EMBEDDING_DIMENSIONS, SOURCE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { type SQL, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

import { user } from './auth-schema';

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

const bytea = customType<{ data: Uint8Array }>({
  dataType: () => 'bytea',
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const sourceKind = pgEnum('source_kind', SOURCE_KIND);
export const sourceStatus = pgEnum('source_status', SOURCE_STATUS);
export const chatRole = pgEnum('chat_role', CHAT_ROLE);

// user_id is the Better Auth user id. Deleting a user deletes their notebooks and sources. Every
// query still filters by user_id: the foreign key is integrity, not authorization (see AGENTS.md).
export const notebooks = pgTable(
  'notebooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: createdAt(),
  },
  (table) => [index('notebooks_user_id_idx').on(table.userId)]
);

// One stored document per user and content hash: the same content is parsed and embedded once.
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    contentHash: text('content_hash').notNull(),
    kind: sourceKind('kind').notNull(),
    title: text('title').notNull(),
    sourceUrl: text('source_url'),
    status: sourceStatus('status').notNull().default(SOURCE_STATUS.PENDING),
    errorMessage: text('error_message'),
    canonicalText: text('canonical_text'),
    pageCount: integer('page_count'),
    // Summary, key topics and suggested questions (SourceOverviewSchema). Made on first request.
    overview: jsonb('overview'),
    createdAt: createdAt(),
  },
  (table) => [unique('sources_user_content_hash_unique').on(table.userId, table.contentHash)]
);

// The raw bytes of an upload live here only until the ingestion job has processed them, then the
// row is deleted: the product stores extracted text, not original files.
export const sourceUploads = pgTable('source_uploads', {
  sourceId: uuid('source_id')
    .primaryKey()
    .references(() => sources.id, { onDelete: 'cascade' }),
  bytes: bytea('bytes').notNull(),
  createdAt: createdAt(),
});

export const notebookSources = pgTable(
  'notebook_sources',
  {
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    selected: boolean('selected').notNull().default(true),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.notebookId, table.sourceId] }),
    index('notebook_sources_source_id_idx').on(table.sourceId),
  ]
);

// startOffset/endOffset point into sources.canonical_text and drive the highlight in the reader.
// 'simple' full-text config: no stemming, but it works for mixed German and English sources.
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    text: text('text').notNull(),
    startOffset: integer('start_offset').notNull(),
    endOffset: integer('end_offset').notNull(),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${chunks.text})`
    ),
  },
  (table) => [
    unique('chunks_source_ordinal_unique').on(table.sourceId, table.ordinal),
    index('chunks_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('chunks_search_vector_gin_idx').using('gin', table.searchVector),
  ]
);

// The chat history of a notebook. A user message has text, an assistant message has the checked
// statements as JSON (validated with ChatMessageSchema when read). seq gives a stable order even
// when two rows are written in the same instant. user_id is repeated so every read filters by it.
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity().notNull(),
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    text: text('text'),
    statements: jsonb('statements'),
    createdAt: createdAt(),
  },
  (table) => [index('chat_messages_notebook_seq_idx').on(table.notebookId, table.seq)]
);
