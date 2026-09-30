import {
  type Notebook,
  SOURCE_FAILURE,
  SOURCE_STATUS,
  type SourceFailure,
  type SourceSummary,
} from '@nlm/shared';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';

import type { Database } from './client';
import { notebooks, notebookSources, sources } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MS_PER_HOUR = 3_600_000;
const FAILURES = new Set<string>(Object.values(SOURCE_FAILURE));

function toFailure(message: string | null): SourceFailure | null {
  return message !== null && FAILURES.has(message) ? (message as SourceFailure) : null;
}

/** Every function below takes the user ID from the session and filters by it in SQL. */

/** The number of sources linked to a notebook, counted by the database. */
const sourceCountOf = sql<number>`(select count(*)::int from ${notebookSources} where ${notebookSources.notebookId} = ${notebooks.id})`;

const notebookColumns = {
  id: notebooks.id,
  title: notebooks.title,
  createdAt: notebooks.createdAt,
  sourceCount: sourceCountOf,
};

function toNotebook(row: {
  id: string;
  title: string;
  createdAt: Date;
  sourceCount: number;
}): Notebook {
  return {
    id: row.id,
    title: row.title,
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
  return toNotebook({ ...row, sourceCount: 0 });
}

export async function listNotebooks(db: Database, userId: string): Promise<Notebook[]> {
  const rows = await db
    .select(notebookColumns)
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(desc(notebooks.createdAt), desc(notebooks.id));
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

/** Gives the notebook a new title. Null when it is not the user's or does not exist. */
export async function renameNotebook(
  db: Database,
  userId: string,
  notebookId: string,
  title: string
): Promise<Notebook | null> {
  if (!UUID.test(notebookId)) return null;
  const renamed = await db
    .update(notebooks)
    .set({ title })
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)))
    .returning({ id: notebooks.id });
  return renamed.length === 1 ? findNotebook(db, userId, notebookId) : null;
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
