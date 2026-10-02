import { SOURCE_FAILURE, SOURCE_STATUS, type SourceFailure, type SourceSummary } from '@nlm/shared';
import { and, asc, count, eq, gte, sql } from 'drizzle-orm';

import type { Database } from './client';
import { ownedNotebookSource } from './ownership';
import { notebooks, notebookSources, sources } from './schema';
import { UUID } from './uuid';

const MS_PER_HOUR = 3_600_000;
const FAILURES = new Set<string>(Object.values(SOURCE_FAILURE));

function toFailure(message: string | null): SourceFailure | null {
  return message !== null && FAILURES.has(message) ? (message as SourceFailure) : null;
}

/** Every function below takes the user ID from the session and filters by it in SQL. */

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
    .where(ownedNotebookSource(notebookId, userId))
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
        ownedNotebookSource(notebookId, userId),
        eq(notebookSources.selected, true),
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
    .where(and(ownedNotebookSource(notebookId, userId), eq(notebookSources.sourceId, sourceId)));
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
 * Selects or deselects every ready source of the notebook in one statement, so a failure never
 * leaves a half-changed selection. False when the notebook is not the user's or does not exist.
 */
export async function setReadySourcesSelected(
  db: Database,
  userId: string,
  notebookId: string,
  selected: boolean
): Promise<boolean> {
  if (!UUID.test(notebookId)) return false;
  const result = await db.execute<{ owned: number }>(sql`
    WITH owned AS (
      SELECT id FROM notebooks WHERE id = ${notebookId} AND user_id = ${userId}
    ), changed AS (
      UPDATE notebook_sources ns SET selected = ${selected}
      FROM owned, sources s
      WHERE ns.notebook_id = owned.id AND s.id = ns.source_id
        AND s.user_id = ${userId} AND s.status = ${SOURCE_STATUS.READY}
      RETURNING ns.source_id
    )
    SELECT count(*)::int AS owned FROM owned`);
  return result.rows[0]?.owned === 1;
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
  db: Pick<Database, 'select'>,
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
