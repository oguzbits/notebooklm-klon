import {
  type NewStudioOutput,
  SOURCE_STATUS,
  STUDIO_KIND,
  type StudioOutput,
  StudioOutputSchema,
  type StudioUpdateBody,
} from '@nlm/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Database } from './client';
import { notebooks, studioOutputs } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OutputRow = typeof studioOutputs.$inferSelect;

/**
 * A list of IDs as the text of a Postgres array, for a parameter cast to `uuid[]` (Drizzle spreads a
 * JavaScript array into a list of parameters). Anything that is no UUID is left out, so a picked
 * source that cannot exist matches nothing. Null: no choice was made.
 */
const uuidArray = (ids: readonly string[] | undefined): string | null =>
  ids === undefined ? null : `{${ids.filter((id) => UUID.test(id)).join(',')}}`;

// A stored output that does not fit the contract is a bug, not a case to skip: parse throws.
const toOutput = (row: OutputRow): StudioOutput =>
  StudioOutputSchema.parse({
    id: row.id,
    kind: row.kind,
    ...(row.format === null ? {} : { format: row.format }),
    title: row.title,
    content: row.content,
    request: row.request,
    unread: row.unread,
    feedback: row.feedback,
    createdAt: row.createdAt.toISOString(),
  });

/** Every function below takes the user ID from the session and filters by it in SQL. */

/** Null when the notebook is not the user's. */
export async function createStudioOutput(
  db: Database,
  userId: string,
  notebookId: string,
  output: NewStudioOutput
): Promise<StudioOutput | null> {
  if (!UUID.test(notebookId)) return null;
  const [owned] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
  if (!owned) return null;
  const [row] = await db
    .insert(studioOutputs)
    .values({
      notebookId,
      userId,
      kind: output.kind,
      format: output.kind === STUDIO_KIND.REPORT ? output.format : null,
      title: output.title,
      content: output.content,
      request: output.request,
      // Made just now, so nobody has looked at it yet.
      unread: true,
    })
    .returning();
  if (!row) throw new Error('The insert returned no row.');
  return toOutput(row);
}

/**
 * Changes the name of an output, what the reader thought of it, or clears its unread mark. Null when
 * there is no such output of this user in this notebook.
 */
export async function updateStudioOutput(
  db: Database,
  userId: string,
  notebookId: string,
  outputId: string,
  changes: StudioUpdateBody
): Promise<StudioOutput | null> {
  if (!UUID.test(notebookId) || !UUID.test(outputId)) return null;
  const set: Partial<typeof studioOutputs.$inferInsert> = {};
  if (changes.title !== undefined) set.title = changes.title;
  if (changes.feedback !== undefined) set.feedback = changes.feedback;
  if (changes.read === true) set.unread = false;
  const [row] = await db
    .update(studioOutputs)
    .set(set)
    .where(
      and(
        eq(studioOutputs.id, outputId),
        eq(studioOutputs.notebookId, notebookId),
        eq(studioOutputs.userId, userId)
      )
    )
    .returning();
  return row ? toOutput(row) : null;
}

export async function listStudioOutputs(
  db: Database,
  userId: string,
  notebookId: string
): Promise<StudioOutput[]> {
  if (!UUID.test(notebookId)) return [];
  const rows = await db
    .select()
    .from(studioOutputs)
    .where(and(eq(studioOutputs.notebookId, notebookId), eq(studioOutputs.userId, userId)))
    .orderBy(desc(studioOutputs.createdAt), desc(studioOutputs.id));
  return rows.map(toOutput);
}

export async function deleteStudioOutput(
  db: Database,
  userId: string,
  notebookId: string,
  outputId: string
): Promise<boolean> {
  if (!UUID.test(notebookId) || !UUID.test(outputId)) return false;
  const deleted = await db
    .delete(studioOutputs)
    .where(
      and(
        eq(studioOutputs.id, outputId),
        eq(studioOutputs.notebookId, notebookId),
        eq(studioOutputs.userId, userId)
      )
    )
    .returning({ id: studioOutputs.id });
  return deleted.length === 1;
}

/**
 * The selected, ready sources of the notebook the Studio may work on, or only the ones the reader
 * picked among them. A picked source that is not selected, not ready or not the user's is ignored.
 */
export async function listStudioSources(
  db: Database,
  userId: string,
  notebookId: string,
  sourceIds?: readonly string[]
): Promise<{ id: string; title: string }[]> {
  if (!UUID.test(notebookId)) return [];
  const picked = uuidArray(sourceIds);
  const result = await db.execute<{ id: string; title: string }>(sql`
    SELECT s.id, s.title
    FROM notebook_sources ns
    JOIN notebooks n ON n.id = ns.notebook_id
    JOIN sources s ON s.id = ns.source_id
    WHERE ns.notebook_id = ${notebookId} AND ns.selected
      AND n.user_id = ${userId} AND s.user_id = ${userId} AND s.status = ${SOURCE_STATUS.READY}
      AND (${picked}::uuid[] IS NULL OR s.id = ANY(${picked}::uuid[]))
    ORDER BY ns.added_at, s.id`);
  return result.rows;
}

/**
 * The text the Studio works on: the chunks of the selected, ready sources of the notebook (or only
 * the ones picked among them) in reading order, at most `maxChars` characters in all. The budget is
 * shared equally between the sources and the start of every source is always kept, so one long
 * source cannot push the others out.
 */
export async function loadStudioChunks(
  db: Database,
  userId: string,
  notebookId: string,
  maxChars: number,
  sourceIds?: readonly string[]
): Promise<{ id: string; text: string }[]> {
  if (!UUID.test(notebookId)) return [];
  const picked = uuidArray(sourceIds);
  const result = await db.execute<{ id: string; text: string }>(sql`
    WITH selected AS (
      SELECT s.id, ns.added_at
      FROM notebook_sources ns
      JOIN notebooks n ON n.id = ns.notebook_id
      JOIN sources s ON s.id = ns.source_id
      WHERE ns.notebook_id = ${notebookId} AND ns.selected
        AND n.user_id = ${userId} AND s.user_id = ${userId} AND s.status = ${SOURCE_STATUS.READY}
        AND (${picked}::uuid[] IS NULL OR s.id = ANY(${picked}::uuid[]))
    ),
    budget AS (SELECT (${maxChars}::int / GREATEST(count(*), 1)) AS per_source FROM selected),
    running AS (
      SELECT c.id, c.text, c.ordinal, sel.id AS source_id, sel.added_at,
        sum(length(c.text)) OVER (PARTITION BY c.source_id ORDER BY c.ordinal) AS total
      FROM chunks c
      JOIN selected sel ON sel.id = c.source_id
    )
    SELECT r.id, r.text
    FROM running r, budget b
    WHERE r.total <= b.per_source OR r.ordinal = 0
    ORDER BY r.added_at, r.source_id, r.ordinal`);
  return result.rows;
}
