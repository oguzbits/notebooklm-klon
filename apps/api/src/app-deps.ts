import type { Auth } from './auth/auth';
import type { ChatPorts } from './chat/answer';
import type { Database } from './db/client';
import type { FetchDeps } from './import/fetch-url';
import type { SubmitPorts } from './ingestion/submit';

/** Everything the routes need from the outside, so tests can swap the network and the queue. */
export interface AppDeps {
  auth: Auth;
  db: Database;
  ingest: SubmitPorts;
  /** Whose example notebook guests get a copy of (SEED_DEMO_EMAIL). Without it there are no guests. */
  demoOwnerEmail: string | undefined;
  fetch: FetchDeps;
  /** The provider side of the chat: the rest of the chat ports comes from the database. */
  chat: Pick<ChatPorts, 'embedQuery' | 'stream' | 'onError'>;
}
