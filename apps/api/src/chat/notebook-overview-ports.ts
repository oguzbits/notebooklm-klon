import type { Database } from '../db/client';
import { findNotebookForOverview, saveNotebookOverview } from '../db/notebook-overview-repository';
import type { NotebookOverviewPorts } from './notebook-overview';

/** The notebook overview ports on the database, with the model passed in. */
export function createNotebookOverviewPorts(
  db: Database,
  stream: NotebookOverviewPorts['stream']
): NotebookOverviewPorts {
  return {
    find: (userId, notebookId) => findNotebookForOverview(db, userId, notebookId),
    save: (userId, notebookId, overview, key) =>
      saveNotebookOverview(db, userId, notebookId, overview, key),
    stream,
  };
}
