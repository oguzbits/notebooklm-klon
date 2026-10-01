import { type NotebookOverview, NotebookOverviewSchema, SOURCE_STATUS } from '@nlm/shared';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import type { Database } from './client';
import { notebooks, notebookSources, sources } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the overview of a notebook is made from, and the one that was made before. */
export interface NotebookOverviewSource {
  id: string;
  title: string;
  text: string;
}

export interface StoredNotebookOverview {
  overview: NotebookOverview;
  /** Names the set of sources the overview was made from (`notebookOverviewKey`). */
  key: string;
}

/**
 * The ready sources of the notebook with their text, in the order they were added (selected or
 * not: the overview covers the whole notebook), and the stored overview. Null when the notebook is
 * not the user's.
 */
export async function findNotebookForOverview(
  db: Database,
  userId: string,
  notebookId: string
): Promise<{
  sources: NotebookOverviewSource[];
  stored: StoredNotebookOverview | null;
  customSummary: string | null;
} | null> {
  if (!UUID.test(notebookId)) return null;
  const [notebook] = await db
    .select({
      overview: notebooks.overview,
      key: notebooks.overviewKey,
      customSummary: notebooks.customSummary,
    })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
  if (!notebook) return null;

  const rows = await db
    .select({ id: sources.id, title: sources.title, text: sources.canonicalText })
    .from(notebookSources)
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .innerJoin(sources, eq(sources.id, notebookSources.sourceId))
    .where(
      and(
        eq(notebookSources.notebookId, notebookId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId),
        eq(sources.status, SOURCE_STATUS.READY),
        isNotNull(sources.canonicalText)
      )
    )
    .orderBy(asc(notebookSources.addedAt), asc(sources.id));

  return {
    customSummary: notebook.customSummary,
    sources: rows.flatMap((row) =>
      row.text === null ? [] : [{ id: row.id, title: row.title, text: row.text }]
    ),
    // A stored value that does not fit the contract is a bug, not a case to skip: parse throws.
    stored:
      notebook.overview === null || notebook.key === null
        ? null
        : { overview: NotebookOverviewSchema.parse(notebook.overview), key: notebook.key },
  };
}

export async function saveNotebookOverview(
  db: Database,
  userId: string,
  notebookId: string,
  overview: NotebookOverview,
  key: string
): Promise<void> {
  if (!UUID.test(notebookId)) return;
  await db
    .update(notebooks)
    .set({ overview, overviewKey: key })
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
}
