import type { UserScope } from '../db/client';
import { findNotebookForOverview, saveNotebookOverview } from '../db/notebook-overview-repository';
import type { NotebookOverviewPorts } from './notebook-overview';

/** The notebook overview ports on the database, with the model passed in. */
export function createNotebookOverviewPorts(
  inUser: UserScope,
  stream: NotebookOverviewPorts['stream']
): NotebookOverviewPorts {
  return {
    find: (userId, notebookId) =>
      inUser(userId, (db) => findNotebookForOverview(db, userId, notebookId)),
    save: (userId, notebookId, overview, key) =>
      inUser(userId, (db) => saveNotebookOverview(db, userId, notebookId, overview, key)),
    stream,
  };
}
