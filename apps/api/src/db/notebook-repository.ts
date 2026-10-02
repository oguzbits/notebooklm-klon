import { type Notebook, NOTEBOOK_TITLE_MAX_CHARS, type UpdateNotebookBody } from '@nlm/shared';
import { desc, eq, sql } from 'drizzle-orm';

import type { Database } from './client';
import { ownedNotebook } from './ownership';
import { notebooks, notebookSources } from './schema';
import { UUID } from './uuid';

const COPY_PREFIX = 'Kopie von ';
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
    .where(ownedNotebook(notebookId, userId));
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
    .where(ownedNotebook(notebookId, userId))
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
      .where(ownedNotebook(notebookId, userId))
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
    const [original] = await tx.select().from(notebooks).where(ownedNotebook(notebookId, userId));
    if (!original) return null;
    const [copy] = await tx
      .insert(notebooks)
      .values({
        userId,
        title: `${COPY_PREFIX}${original.title}`.slice(0, NOTEBOOK_TITLE_MAX_CHARS),
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
    .where(ownedNotebook(notebookId, userId))
    .returning({ id: notebooks.id });
  return deleted.length === 1;
}
