import { getOrCreateNotebookOverview, type NotebookOverviewPorts } from '../chat/notebook-overview';
import { getOrCreateOverview, type OverviewPorts } from '../chat/overview';
import type { Database } from '../db/client';
import { createNotebook, listNotebooks } from '../db/notebook-repository';
import { importLocalFiles, type LocalFile, type LocalImportDeps } from '../ingestion/local-import';

export const DEMO_NOTEBOOK_TITLE = 'Beispiel: Projekt Nordlicht';

export interface SeedDemoDeps {
  db: Database;
  importDeps: LocalImportDeps;
  overview: OverviewPorts;
  notebookOverview: NotebookOverviewPorts;
  /** The ID of the demo user, who is made first if the account does not exist yet. */
  ensureUser: () => Promise<string>;
}

/**
 * The example notebook for the live demo: a demo user, a notebook with a few documents that are
 * read and have their overviews already (one per source and one for the notebook, which also
 * gives it its symbol), so a reviewer can ask questions at once without using up
 * quota for parsing. Safe to run again: it finds the notebook, reuses known content and skips
 * overviews that exist.
 */
export async function seedDemo(
  input: { files: LocalFile[] },
  deps: SeedDemoDeps
): Promise<{ userId: string; notebookId: string }> {
  const userId = await deps.ensureUser();
  const existing = (await listNotebooks(deps.db, userId)).find(
    (notebook) => notebook.title === DEMO_NOTEBOOK_TITLE
  );
  const notebookId =
    existing?.id ?? (await createNotebook(deps.db, userId, DEMO_NOTEBOOK_TITLE)).id;

  const sourceIds = await importLocalFiles(
    { userId, notebookId, files: input.files },
    deps.importDeps
  );
  for (const sourceId of sourceIds.values()) {
    await getOrCreateOverview({ userId, notebookId, sourceId }, deps.overview);
  }
  await getOrCreateNotebookOverview({ userId, notebookId }, deps.notebookOverview);
  return { userId, notebookId };
}
