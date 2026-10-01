import {
  CHAT_ROLE,
  EMBEDDING_DIMENSIONS,
  NOTE_KIND,
  SOURCE_KIND,
  SOURCE_STATUS,
  STUDIO_KIND,
} from '@nlm/shared';
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
export const studioKind = pgEnum('studio_kind', STUDIO_KIND);
export const noteKind = pgEnum('note_kind', NOTE_KIND);

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
    // How the assistant talks in this notebook (ChatConfigSchema). Null: the default.
    chatConfig: jsonb('chat_config'),
    // What all sources of the notebook are about (NotebookOverviewSchema) and the key of the set of
    // sources it was made from. Both are null until the first overview exists.
    overview: jsonb('overview'),
    overviewKey: text('overview_key'),
    // A summary the user wrote. When set, it is shown instead of the one the model makes.
    customSummary: text('custom_summary'),
    // When the notebook was pinned to the top of the start page; null: not pinned.
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    // Names the cover image in the object store (covers/<user>/<notebook>/<version>); null: none.
    coverVersion: uuid('cover_version'),
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
    // The questions the assistant suggested after an answer (FollowUpsSchema). Null: none, or an
    // answer from before they existed.
    followUps: jsonb('follow_ups'),
    // How the answer came about (AnswerTraceSchema). Null: an answer from before it was kept, or one
    // that was cut off before it finished.
    trace: jsonb('trace'),
    createdAt: createdAt(),
  },
  (table) => [index('chat_messages_notebook_seq_idx').on(table.notebookId, table.seq)]
);

// A note is a copy of the statements of one saved answer (chat_messages), so its citations were
// checked when the answer was made. message_id is unique: saving the same answer twice gives the
// same note. The link is cut, not the note deleted, if the answer ever goes away.
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .unique()
      .references(() => chatMessages.id, { onDelete: 'set null' }),
    // ANSWER: statements copied from a saved answer. WRITTEN: statements stay empty and body holds
    // the reader's Markdown. Every note from before the kinds existed is an answer.
    kind: noteKind('kind').notNull().default(NOTE_KIND.ANSWER),
    statements: jsonb('statements').notNull(),
    title: text('title'),
    body: text('body'),
    createdAt: createdAt(),
  },
  (table) => [index('notes_notebook_idx').on(table.notebookId, table.createdAt)]
);

// What the Studio made from the selected sources: a report, flashcards, a quiz or a mind map. The
// content is validated with StudioOutputSchema when read and holds only citations the server
// checked. format is set for reports only. request is how it was asked for (the prompt in words and
// the titles of the sources), unread is the blue dot until the output is opened (false for the
// outputs made before it existed) and feedback is what the reader thought of it.
export const studioOutputs = pgTable(
  'studio_outputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notebookId: uuid('notebook_id')
      .notNull()
      .references(() => notebooks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: studioKind('kind').notNull(),
    format: text('format'),
    title: text('title').notNull(),
    content: jsonb('content').notNull(),
    request: jsonb('request'),
    unread: boolean('unread').notNull().default(false),
    feedback: text('feedback'),
    createdAt: createdAt(),
  },
  (table) => [index('studio_outputs_notebook_idx').on(table.notebookId, table.createdAt)]
);
