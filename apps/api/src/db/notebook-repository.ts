import {
  type Notebook,
  SOURCE_FAILURE,
  SOURCE_STATUS,
  type SourceFailure,
  type SourceSummary,
  type UpdateNotebookBody,
} from '@nlm/shared';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';

import type { Database } from './client';
import { notebooks, notebookSources, sources } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MS_PER_HOUR = 3_600_000;
const COPY_PREFIX = 'Kopie von ';
const MAX_NOTEBOOK_TITLE_CHARS = 200;
const FAILURES = new Set<string>(Object.values(SOURCE_FAILURE));

function toFailure(message: string | null): SourceFailure | null {
  return message !== null && FAILURES.has(message) ? (message as SourceFailure) : null;
}

/** Every function below takes the user ID from the session and filters by it in SQL. */

/** The number of sources linked to a notebook, counted by the database. */
const sourceCountOf = sql<number>`(select count(*)::int from ${notebookSources} where ${notebookSources.notebookId} = ${notebooks.id})`;

/** The symbol the overview of the notebook chose, null while there is no overview. */
const emojiOf = sql<string | null>`${notebooks.overview}->>'emoji'`;

const notebookColumns = {
  id: notebooks.id,
  title: notebooks.title,
  emoji: emojiOf,
  customSummary: notebooks.customSummary,
  pinned: sql<boolean>`${notebooks.pinnedAt} is not null`,
  coverVersion: notebooks.coverVersion,
  createdAt: notebooks.createdAt,
  sourceCount: sourceCountOf,
};

function toNotebook(row: {
  id: string;
  title: string;
  emoji: string | null;
  customSummary: string | null;
  pinned: boolean;
  coverVersion: string | null;
  createdAt: Date;
  sourceCount: number;
}): Notebook {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    customSummary: row.customSummary,
    pinned: row.pinned,
    coverVersion: row.coverVersion,
    sourceCount: row.sourceCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotebook(
  db: Database,
  userId: string,
  title: string
): Promise<Notebook> {
  const [row] = await db.insert(notebooks).values({ userId, title }).returning();
  if (!row) throw new Error('insert returned no row');
  return toNotebook({ ...row, emoji: null, pinned: false, coverVersion: null, sourceCount: 0 });
}

export async function listNotebooks(db: Database, userId: string): Promise<Notebook[]> {
  const rows = await db
    .select(notebookColumns)
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(
      sql`${notebooks.pinnedAt} desc nulls last`,
      desc(notebooks.createdAt),
      desc(notebooks.id)
    );
  return rows.map(toNotebook);
}

export async function findNotebook(
  db: Database,
  userId: string,
  notebookId: string
): Promise<Notebook | null> {
  if (!UUID.test(notebookId)) return null;
  const [row] = await db
    .select(notebookColumns)
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
  return row ? toNotebook(row) : null;
}

/**
 * Changes the title, the own summary (null takes it back) and/or the pin of the notebook; what is
 * left out stays. Null when it is not the user's or does not exist.
 */
export async function updateNotebook(
  db: Database,
  userId: string,
  notebookId: string,
  changes: UpdateNotebookBody
): Promise<Notebook | null> {
  if (!UUID.test(notebookId)) return null;
  const updated = await db
    .update(notebooks)
    .set({
      ...(changes.title !== undefined && { title: changes.title }),
      ...(changes.customSummary !== undefined && { customSummary: changes.customSummary }),
      ...(changes.pinned !== undefined && { pinnedAt: changes.pinned ? new Date() : null }),
    })
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
    .returning({ id: notebooks.id });
  return updated.length === 1 ? findNotebook(db, userId, notebookId) : null;
}

/**
 * Sets the cover image of the notebook (or takes it back with null) and returns the notebook and
 * the version it had before, so the caller can remove that file. Null when it is not the user's.
 */
export async function setCoverVersion(
  db: Database,
  userId: string,
  notebookId: string,
  version: string | null
): Promise<{ notebook: Notebook; previous: string | null } | null> {
  if (!UUID.test(notebookId)) return null;
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ coverVersion: notebooks.coverVersion })
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
      .for('update');
    if (!before) return null;
    await tx.update(notebooks).set({ coverVersion: version }).where(eq(notebooks.id, notebookId));
    const [row] = await tx
      .select(notebookColumns)
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));
    return row ? { notebook: toNotebook(row), previous: before.coverVersion } : null;
  });
}

/**
 * Makes a copy of the notebook for the same user: its settings, its summaries and the same sources
 * (linked, not read or embedded again). Chat history, notes and Studio outputs stay with the
 * original. Null when it is not the user's or does not exist.
 */
export async function duplicateNotebook(
  db: Database,
  userId: string,
  notebookId: string
): Promise<Notebook | null> {
  if (!UUID.test(notebookId)) return null;
  const copyId = await db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(notebooks)
      .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
    if (!original) return null;
    const [copy] = await tx
      .insert(notebooks)
      .values({
        userId,
        title: `${COPY_PREFIX}${original.title}`.slice(0, MAX_NOTEBOOK_TITLE_CHARS),
        chatConfig: original.chatConfig,
        overview: original.overview,
        overviewKey: original.overviewKey,
        customSummary: original.customSummary,
      })
      .returning({ id: notebooks.id });
    if (!copy) throw new Error('The copy of the notebook was not made.');
    // Same sources, so the key of the stored overview still names exactly this set.
    await tx.execute(sql`
      INSERT INTO notebook_sources (notebook_id, source_id, selected, added_at)
      SELECT ${copy.id}, ns.source_id, ns.selected, ns.added_at
      FROM notebook_sources ns
      INNER JOIN sources s ON s.id = ns.source_id
      WHERE ns.notebook_id = ${notebookId} AND s.user_id = ${userId}`);
    return copy.id;
  });
  return copyId === null ? null : findNotebook(db, userId, copyId);
}

/** Deletes the notebook with its links and chat history. The sources stay: they are the user's. */
export async function deleteNotebook(
  db: Database,
  userId: string,
  notebookId: string
): Promise<boolean> {
  if (!UUID.test(notebookId)) return false;
  const deleted = await db
    .delete(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
    .returning({ id: notebooks.id });
  return deleted.length === 1;
}

export async function listNotebookSources(
  db: Database,
  userId: string,
  notebookId: string
): Promise<SourceSummary[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select({
      id: sources.id,
      title: sources.title,
      kind: sources.kind,
      status: sources.status,
      errorMessage: sources.errorMessage,
      pageCount: sources.pageCount,
      selected: notebookSources.selected,
      createdAt: sources.createdAt,
    })
    .from(notebookSources)
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .innerJoin(sources, eq(sources.id, notebookSources.sourceId))
    .where(
      and(
        eq(notebookSources.notebookId, notebookId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId)
      )
    )
    .orderBy(asc(notebookSources.addedAt), asc(sources.id));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    failure: toFailure(row.errorMessage),
    pageCount: row.pageCount,
    selected: row.selected,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Sources the user selected in this notebook that are ready to answer from. */
export async function selectedReadySourceIds(
  db: Database,
  userId: string,
  notebookId: string
): Promise<string[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select({ id: sources.id })
    .from(notebookSources)
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .innerJoin(sources, eq(sources.id, notebookSources.sourceId))
    .where(
      and(
        eq(notebookSources.notebookId, notebookId),
        eq(notebookSources.selected, true),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId),
        eq(sources.status, SOURCE_STATUS.READY)
      )
    )
    .orderBy(asc(notebookSources.addedAt), asc(sources.id));
  return rows.map((row) => row.id);
}

/** Links a source to a notebook. False when the notebook or the source is not the user's. */
export async function linkSource(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return false;
  const result = await db.execute(sql`
    INSERT INTO notebook_sources (notebook_id, source_id)
    SELECT n.id, s.id
    FROM notebooks n, sources s
    WHERE n.id = ${notebookId} AND n.user_id = ${userId}
      AND s.id = ${sourceId} AND s.user_id = ${userId}
    ON CONFLICT DO NOTHING
    RETURNING source_id`);
  if (result.rowCount === 1) return true;
  // Nothing inserted: either it was already linked (fine) or the ownership check failed.
  const [existing] = await db
    .select({ id: notebookSources.sourceId })
    .from(notebookSources)
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .innerJoin(sources, eq(sources.id, notebookSources.sourceId))
    .where(
      and(
        eq(notebookSources.notebookId, notebookId),
        eq(notebookSources.sourceId, sourceId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId)
      )
    );
  return existing !== undefined;
}

export async function setSourceSelected(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string,
  selected: boolean
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return false;
  const result = await db.execute(sql`
    UPDATE notebook_sources ns SET selected = ${selected}
    FROM notebooks n, sources s
    WHERE ns.notebook_id = ${notebookId} AND ns.source_id = ${sourceId}
      AND n.id = ns.notebook_id AND n.user_id = ${userId}
      AND s.id = ns.source_id AND s.user_id = ${userId}
    RETURNING ns.source_id`);
  return result.rowCount === 1;
}

/**
 * Gives a source of the notebook a new title. The title belongs to the source, so it changes in
 * every notebook of the user that holds it. False when the source is not linked to this notebook of
 * the user.
 */
export async function renameSource(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string,
  title: string
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return false;
  const result = await db.execute(sql`
    UPDATE sources s SET title = ${title}
    FROM notebook_sources ns, notebooks n
    WHERE s.id = ${sourceId} AND s.user_id = ${userId}
      AND ns.source_id = s.id AND ns.notebook_id = ${notebookId}
      AND n.id = ns.notebook_id AND n.user_id = ${userId}
    RETURNING s.id`);
  return result.rowCount === 1;
}

export async function unlinkSource(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return false;
  const result = await db.execute(sql`
    DELETE FROM notebook_sources ns
    USING notebooks n, sources s
    WHERE ns.notebook_id = ${notebookId} AND ns.source_id = ${sourceId}
      AND n.id = ns.notebook_id AND n.user_id = ${userId}
      AND s.id = ns.source_id AND s.user_id = ${userId}
    RETURNING ns.source_id`);
  return result.rowCount === 1;
}

/** Sources the user created within the last `hours`, for the upload quota. */
export async function countSourcesSince(
  db: Database,
  userId: string,
  hours: number
): Promise<number> {
  const since = new Date(Date.now() - hours * MS_PER_HOUR);
  const [row] = await db
    .select({ total: count() })
    .from(sources)
    .where(and(eq(sources.userId, userId), gte(sources.createdAt, since)));
  return row?.total ?? 0;
}
