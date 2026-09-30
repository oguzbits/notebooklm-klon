import type { Database } from '../db/client';
import { findSourceForOverview, saveOverview } from '../db/overview-repository';
import type { OverviewPorts } from './overview';

/** The overview ports on the database, with the model passed in. */
export function createOverviewPorts(db: Database, stream: OverviewPorts['stream']): OverviewPorts {
  return {
    find: (userId, notebookId, sourceId) => findSourceForOverview(db, userId, notebookId, sourceId),
    save: (userId, sourceId, overview) => saveOverview(db, userId, sourceId, overview),
    stream,
  };
}
