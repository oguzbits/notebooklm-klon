import type { SourceKind } from '@nlm/shared';

import type { AppDeps } from '../app-deps';
import { createAuth } from '../auth/auth';
import { createQuota } from '../db/quota';
import { createSourceStorage, createUploadStorage } from '../db/source-storage';
import { createTestDb } from '../db/testing/test-db';
import type { FetchDeps } from '../import/fetch-url';

export const BASE_URL = 'http://localhost:3000';
export const SECRET = 'a-test-secret-with-at-least-32-characters';

/** Everything the routes call out to, recorded instead of executed. */
export function createHarness(overrides: { fetch?: FetchDeps } = {}) {
  const { db, pool } = createTestDb();
  const auth = createAuth(db, { secret: SECRET, baseURL: BASE_URL });
  const enqueued: string[] = [];
  const parsedKinds: SourceKind[] = [];

  const deps: AppDeps = {
    auth,
    db,
    ingest: {
      sources: createSourceStorage(db),
      uploads: createUploadStorage(db),
      queue: {
        enqueue: async (sourceId) => {
          enqueued.push(sourceId);
        },
      },
      assertCanCreate: createQuota(db),
      // The request path never parses or embeds, the job does.
      parse: async (kind) => {
        parsedKinds.push(kind);
        return { text: '', pageCount: null };
      },
      embed: async () => [],
    },
    fetch: overrides.fetch ?? {
      lookup: async () => {
        throw new Error('no network in tests');
      },
      request: async () => {
        throw new Error('no network in tests');
      },
    },
  };
  return { deps, db, pool, auth, enqueued, parsedKinds };
}
