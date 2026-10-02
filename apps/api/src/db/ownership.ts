import { and, eq, type SQL } from 'drizzle-orm';

import { notebooks, notebookSources, sources } from './schema';

/** `and` types its result as possibly undefined, and `.where(undefined)` would drop the scope. */
function allOf(...conditions: SQL[]): SQL {
  const combined = and(...conditions);
  if (!combined) throw new Error('An ownership predicate needs at least one condition');
  return combined;
}

/** The notebook with this ID, and only if the user owns it. */
export const ownedNotebook = (notebookId: string, userId: string): SQL =>
  allOf(eq(notebooks.id, notebookId), eq(notebooks.userId, userId));

/**
 * The rows of `notebookSources` that link a source to this notebook while the user owns both. The
 * query must join `notebooks` (on `notebookSources.notebookId`) and `sources` (on
 * `notebookSources.sourceId`) for these columns to exist.
 */
export const ownedNotebookSource = (notebookId: string, userId: string): SQL =>
  allOf(
    eq(notebookSources.notebookId, notebookId),
    eq(notebooks.userId, userId),
    eq(sources.userId, userId)
  );
