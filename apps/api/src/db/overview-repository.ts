import { type SourceOverview, SourceOverviewSchema } from '@nlm/shared';
import { and, eq, isNotNull } from 'drizzle-orm';

import type { Database } from './client';
import { notebooks, notebookSources, sources } from './schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The source with its text and stored overview, if the user may read it in this notebook. */
export async function findSourceForOverview(
  db: Database,
  userId: string,
  notebookId: string,
  sourceId: string
): Promise<{ title: string; text: string; overview: SourceOverview | null } | null> {
  if (!UUID.test(notebookId) || !UUID.test(sourceId)) return null;
  const [row] = await db
    .select({ title: sources.title, text: sources.canonicalText, overview: sources.overview })
    .from(sources)
    .innerJoin(notebookSources, eq(notebookSources.sourceId, sources.id))
    .innerJoin(notebooks, eq(notebooks.id, notebookSources.notebookId))
    .where(
      and(
        eq(sources.id, sourceId),
        eq(notebookSources.notebookId, notebookId),
        eq(notebooks.userId, userId),
        eq(sources.userId, userId),
        isNotNull(sources.canonicalText)
      )
    );
  if (!row || row.text === null) return null;
  // A stored value that does not fit the contract is a bug, not a case to skip: parse throws.
  const overview = row.overview === null ? null : SourceOverviewSchema.parse(row.overview);
  return { title: row.title, text: row.text, overview };
}

export async function saveOverview(
  db: Database,
  userId: string,
  sourceId: string,
  overview: SourceOverview
): Promise<void> {
  await db
    .update(sources)
    .set({ overview })
    .where(and(eq(sources.id, sourceId), eq(sources.userId, userId)));
}
