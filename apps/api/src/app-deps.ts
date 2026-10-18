import type { Auth } from './auth/auth';
import type { ChatPorts } from './chat/answer';
import type { Database } from './db/client';
import type { FetchDeps } from './import/fetch-url';
import type { SubmitPorts } from './ingestion/submit';
import type { ErrorReporter } from './observability/error-reporter';
import type { WebSearch } from './search/tavily-search';
import type { ObjectStore } from './storage/object-store';

/** Everything the routes need from the outside, so tests can swap the network and the queue. */
export interface AppDeps {
  auth: Auth;
  /** The app's connection: row-level security applies, so use it through `forUser`. */
  db: Database;
  /** The owner's connection for work that belongs to nobody: guests, the budget of all users, the health check. */
  systemDb: Database;
  ingest: SubmitPorts;
  /** Whose example notebook guests get a copy of (SEED_DEMO_EMAIL). Without it there are no guests. */
  demoOwnerEmail: string | undefined;
  fetch: FetchDeps;
  /** Looks up pages for new sources. Null: the search is not set up and not offered. */
  webSearch: WebSearch | null;
  /** Holds the cover images. Null: not set up, and cover images are not offered. */
  objectStore: ObjectStore | null;
  /** The provider side of the chat: the rest of the chat ports comes from the database. */
  /** Tells the error tracking about a failure nobody expected. Does nothing when none is set up. */
  reportError: ErrorReporter['report'];
  chat: Pick<ChatPorts, 'embedQuery' | 'translateQuery' | 'stream' | 'onError'>;
}
